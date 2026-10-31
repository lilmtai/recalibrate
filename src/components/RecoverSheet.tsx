import { useState, type CSSProperties } from "react";
import { useApp } from "../ctx";
import { tasksFor } from "../lib/plan";
import { applyRecovery, proposeRecovery, type Change, type RecoveryMode } from "../lib/schedule";
import { addDays, DAY_SHORT, fmt, parseKey, toMin, today, weekday } from "../lib/time";
import { lenLabel } from "../lib/dayLayout";
import { suggestEmoji } from "../lib/emoji";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

const dayName = (d: string, from: string) =>
  d === addDays(from, 1) ? "tomorrow" : `${DAY_SHORT[weekday(d)]} ${parseKey(d).getDate()}`;

/** "Fix my day" / "Minimum day": a proposal you approve, untick, or dismiss. Nothing changes before Approve. */
export function RecoverSheet({ date, mode: startMode }: { date: string; mode?: RecoveryMode }) {
  const { state, update, close, now, toast, celebrate } = useApp();
  const [mode, setMode] = useState<RecoveryMode>(startMode || "fix");
  const [off, setOff] = useState<Set<string>>(new Set());
  const isToday = date === today();
  const tasks = tasksFor(state, date);
  const ci = state.checkins[date] || {};
  const lowEnergy = ci.energy === "low" || (ci.sleep !== undefined && ci.sleep < 6);
  const later = Array.from({ length: 7 }, (_, i) => addDays(date, i + 1)).map((d) => ({ date: d, tasks: tasksFor(state, d) }));
  const p = proposeRecovery({
    date, tasks, now: isToday ? now : -1, dayHours: state.dayHours || { start: "07:00", end: "23:00" },
    mode, lowEnergy, runningId: state.focus?.taskId, later,
  });
  const actionable = p.changes.filter((c) => c.kind !== "nofit");
  const chosen = actionable.filter((c) => !off.has(c.id));
  const toggle = (id: string) => setOff((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const approve = () => {
    let n = 0;
    update((s) => { n = applyRecovery(s, date, tasksFor(s, date), chosen); });
    celebrate();
    toast(n ? `Done: ${n} change${n > 1 ? "s" : ""}. Your day fits again.` : "Nothing changed.");
    close();
  };

  const after = (c: Change) => {
    if (c.kind === "tray") return "to the tray";
    if (c.kind === "skip") return "skip today";
    if (c.kind === "nofit") return "no room";
    const t = c.to!;
    const when = `${t.start} – ${fmt(toMin(t.start) + t.dur)}`;
    if (c.kind === "postpone") return `${dayName(t.date!, date)} ${when}`;
    return c.kind === "shorten" ? `${when} (${lenLabel(t.dur)})` : when;
  };

  const title = mode === "minimum" ? "Minimum day" : "Fix my day";
  const sub = mode === "minimum"
    ? "Keep only what matters most today. Everything else becomes optional."
    : isToday ? `From ${fmt(Math.max(now, toMin((state.dayHours || { start: "07:00" }).start)))}, here's a plan that fits.` : "Here's a plan that fits.";

  return (
    <Sheet title={title} sub={sub} onClose={close}>
      <div className="seg recoverseg" role="group" aria-label="Kind of fix">
        <button aria-pressed={mode === "fix"} onClick={() => { setMode("fix"); setOff(new Set()); }}>Fix my day</button>
        <button aria-pressed={mode === "minimum"} onClick={() => { setMode("minimum"); setOff(new Set()); }}>Minimum day</button>
      </div>

      <div className="recover-keep">
        <Icon name="lock" size={14} stroke={2.4} />
        <span>
          {p.fixedKept ? `${p.fixedKept} fixed appointment${p.fixedKept > 1 ? "s stay where they are" : " stays where it is"}.` : "No fixed appointments today."}
          {p.unchanged > 0 && ` ${p.unchanged} other block${p.unchanged > 1 ? "s stay" : " stays"} as planned.`}
          {lowEnergy && mode === "fix" && " Low-energy day: shorter versions first."}
        </span>
      </div>

      {!p.changes.length ? (
        <div className="empty recover-empty">
          <div className="what">Your day still fits</div>
          <div>Nothing needs to move. Keep going.</div>
        </div>
      ) : (
        <ul className="recoverlist">
          {p.changes.map((c) => {
            const t = tasks.find((x) => x.id === c.id);
            const on = c.kind !== "nofit" && !off.has(c.id);
            return (
              <li key={c.id} className={`k-${c.kind} ${on ? "" : "offc"}`} style={{ "--c": `var(--c-${t?.category || "work"})` } as CSSProperties}>
                <span className="bpill" aria-hidden="true">{t ? t.emoji || suggestEmoji(t.title, t.category, state) : "•"}</span>
                <div className="grow">
                  <div className="rtitle">{c.title}</div>
                  <div className="rmove">
                    <s>{c.from.start} – {fmt(toMin(c.from.start) + c.from.dur)}</s>
                    <span aria-hidden="true">→</span>
                    <b>{after(c)}</b>
                  </div>
                  <div className="small muted">{c.reason}</div>
                </div>
                {c.kind !== "nofit" && (
                  <input type="checkbox" checked={on} onChange={() => toggle(c.id)} aria-label={`Include: ${c.title}`} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="actions">
        <button className="btn ghost" onClick={close}>Dismiss</button>
        <span className="spacer" />
        {actionable.length > 0 && (
          <button className="btn primary" disabled={!chosen.length} onClick={approve}>
            Approve{chosen.length < actionable.length ? ` ${chosen.length}` : ""}
          </button>
        )}
      </div>
    </Sheet>
  );
}
