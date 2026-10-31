import type { CSSProperties } from "react";
import { useApp } from "../ctx";
import type { Task } from "../types";
import { addDays, DAY_SHORT, fmt, fmtShort, parseKey, toMin, today, weekStart } from "../lib/time";
import { materialize, shownDur } from "../lib/plan";
import { completeTask, reopenTask } from "../lib/actions";
import { syncActuals } from "../lib/actuals";
import { suggestEmoji } from "../lib/emoji";
import { Icon } from "./Icon";

/** Week strip: Mon–Sun of the selected day's week; tap a day, arrows change week. */
export function WeekStrip() {
  const { date, setDate } = useApp();
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const month = parseKey(date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div className="weekstrip-wrap">
      <div className="weekstrip-head">
        <button className="btn ghost small" aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}><Icon name="back" size={16} /></button>
        <span className="weekstrip-month">{month}</span>
        <button className="btn ghost small flip" aria-label="Next week" onClick={() => setDate(addDays(date, 7))}><Icon name="back" size={16} /></button>
        <span className="spacer" />
        {date !== today() && <button className="btn small" onClick={() => setDate(today())}>Today</button>}
      </div>
      <div className="weekstrip" role="tablist" aria-label="Day">
        {days.map((d, i) => (
          <button key={d} role="tab" aria-selected={d === date} className={`wsday ${d === today() ? "istoday" : ""} ${d < today() ? "past" : ""}`} onClick={() => setDate(d)}>
            <span>{DAY_SHORT[i][0]}</span>
            <b>{parseKey(d).getDate()}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

const len = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

/**
 * The day as a list: an emoji pill per block (taller for longer blocks), its times, and a
 * check circle that marks it done in one tap. Free time between blocks is shown and tappable.
 */
export function DayList({ tasks, isToday, lowDay }: { tasks: Task[]; isToday: boolean; lowDay: boolean }) {
  const { state, update, open, date, now, celebrate, toast } = useApp();

  const toggle = (t: Task) => {
    if (t.status === "missed" || t.status === "partial") return open({ type: "log", task: t });
    const wasDone = t.status === "done" || t.status === "ifnot";
    update((s) => {
      const real = materialize(s, t);
      if (wasDone) reopenTask(real); else completeTask(s, real);
      syncActuals(s, real);
    });
    if (!wasDone) { celebrate(); if (t.ongoing) toast(`Finished · ${fmtShort(Math.max(5, now - toMin(t.start)))}`); }
  };

  type Row = { kind: "task"; t: Task } | { kind: "free"; from: number; to: number } | { kind: "now" };
  const rows: Row[] = [];
  let cursor = toMin((state.dayHours || { start: "07:00" }).start);
  let nowPlaced = !isToday;
  for (const t of tasks) {
    const s = toMin(t.start);
    if (!nowPlaced && now < s) { rows.push({ kind: "now" }); nowPlaced = true; }
    if (s - cursor >= 30) rows.push({ kind: "free", from: cursor, to: s });
    rows.push({ kind: "task", t });
    cursor = Math.max(cursor, s + shownDur(t, isToday, now));
  }
  if (!nowPlaced) rows.push({ kind: "now" });

  if (!tasks.length) {
    return (
      <div className="daylist empty-list">
        <div className="empty"><div className="what">A clear day</div><div>Tap + to plan a block, or add a routine.</div></div>
      </div>
    );
  }

  return (
    <ol className="daylist" aria-label={`Blocks for ${date}`}>
      {rows.map((r, i) => {
        if (r.kind === "now") return <li key={`now${i}`} className="dnow"><span>{fmt(now)}</span><i /></li>;
        if (r.kind === "free") {
          return (
            <li key={`free${r.from}`} className="dfree">
              <button onClick={() => open({ type: "block", date, start: fmt(r.from) })}>Free · {len(r.to - r.from)} · tap to plan</button>
            </li>
          );
        }
        const t = r.t;
        const d = shownDur(t, isToday, now);
        const s = toMin(t.start);
        const done = t.status === "done" || t.status === "ifnot";
        const running = state.focus?.taskId === t.id;
        const dim = lowDay && t.energy === "high" && t.status === "open";
        const emoji = t.emoji || suggestEmoji(t.title, t.category, state);
        const meta = t.ongoing && t.status === "open"
          ? `${t.start} – ongoing${isToday && now > s ? ` (${len(now - s)} so far)` : ""}`
          : `${t.start} – ${fmt(s + d)} (${len(d)})`;
        return (
          <li key={t.id} className={`drow s-${t.status} ${dim ? "dim" : ""} ${running ? "running" : ""}`} style={{ "--c": `var(--c-${t.category})` } as CSSProperties}>
            <span className="dtime">{t.start}</span>
            <span className="dpill" style={{ minHeight: Math.min(190, Math.max(60, d * 1.1)) }} aria-hidden="true">{emoji}</span>
            <button className="dbody" onClick={() => open({ type: "log", task: t })}>
              <span className="dmeta">{meta}{t.routineId && " · ↻"}</span>
              <span className="dtitle">{t.title}</span>
              {t.status === "missed" && <span className="dnote warn">Didn't happen{t.barrier ? "" : " · tap to log why"}</span>}
              {t.status === "partial" && <span className="dnote">Partly done</span>}
              {t.status === "ifnot" && <span className="dnote">“If not” version done</span>}
              {running && <span className="dnote gold">Focusing now</span>}
              {dim && t.ifNot && <span className="dnote">If not: {t.ifNot}</span>}
            </button>
            <button className={`dcheck ${done ? "on" : ""} ${t.status === "missed" ? "miss" : ""}`} onClick={() => toggle(t)}
              aria-label={done ? `Mark ${t.title} not done` : t.ongoing ? `Finish ${t.title} now` : `Mark ${t.title} done`}>
              {done && <Icon name="check" size={18} stroke={3} />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

