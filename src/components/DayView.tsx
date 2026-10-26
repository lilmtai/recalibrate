import type { CSSProperties } from "react";
import { useApp } from "../ctx";
import { BARRIER_LABEL } from "../constants";
import type { Task } from "../types";
import { addDays, fmt, fmtDur, norm, toMin, today } from "../lib/time";
import { cuesFor, tasksFor } from "../lib/plan";
import { isWin, multiplier } from "../lib/stats";
import { Timeline } from "./Timeline";

export function DayView({ reminders }: { reminders: { permission: string; enable: () => void } }) {
  const { state, update, date, setDate, open, now } = useApp();
  const isToday = date === today();
  const ci = state.checkins[date] || {};
  const tasks = tasksFor(state, date);
  const cues = cuesFor(state, date);
  const lowDay = ci.energy === "low" || (ci.sleep !== undefined && ci.sleep < 6);
  const hasEx = state.tasks.some((t) => t.ex) || state.routines.some((r) => r.ex);

  const setCheckin = (patch: Partial<typeof ci>) =>
    update((s) => { s.checkins[date] = { ...(s.checkins[date] || {}), ...patch }; });
  const clearExamples = () =>
    update((s) => {
      s.tasks = s.tasks.filter((t) => !t.ex);
      s.routines = s.routines.filter((r) => !r.ex);
      s.rules = s.rules.filter((r) => !r.ex);
      for (const k of Object.keys(s.checkins)) if (s.checkins[k].ex) delete s.checkins[k];
    });

  // "never miss twice": same block missed the day before
  const missedYesterday = state.tasks.filter((t) => t.date === addDays(date, -1) && t.status === "missed");
  const repeat = missedYesterday.find((m) => tasks.some((t) => norm(t.title) === norm(m.title)));

  return (
    <>
      <div className="daynav">
        <button className="btn ghost small" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        {!isToday && <button className="btn small" onClick={() => setDate(today())}>Back to today</button>}
        <button className="btn ghost small" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
        <span className="spacer" />
        {hasEx && <button className="btn ghost small" onClick={clearExamples}>Clear example data</button>}
      </div>

      <section className="checkin" aria-label="Daily check-in">
        <div><span className="lbl">Energy</span>
          <span className="seg">
            {(["low", "steady", "high"] as const).map((e) => (
              <button key={e} aria-pressed={ci.energy === e} onClick={() => setCheckin({ energy: e })}>{e[0].toUpperCase() + e.slice(1)}</button>
            ))}
          </span></div>
        <div><label className="lbl" htmlFor="sleep">Slept</label>
          <input className="sleep" id="sleep" type="number" min={0} max={14} step={0.5} placeholder="7"
            value={ci.sleep ?? ""} onChange={(e) => setCheckin({ sleep: e.target.value === "" ? undefined : +e.target.value })} />{" "}
          <span className="muted small">h</span></div>
        {reminders.permission === "default" && (
          <button className="btn small" onClick={reminders.enable}>Turn on reminders</button>
        )}
      </section>

      {repeat ? (
        <div className="banner"><b>Never miss twice.</b><span>You missed “{repeat.title}” yesterday{repeat.barrier && ` (${BARRIER_LABEL[repeat.barrier].toLowerCase()})`}. Today, even the “if not” version counts.</span></div>
      ) : lowDay ? (
        <div className="banner calm"><b>Low-fuel day.</b><span>High-energy blocks are dimmed. Do their “if not” versions and protect one win.</span></div>
      ) : null}

      {!tasks.length ? (
        <div className="card empty" style={{ marginTop: 20 }}>
          <div className="what">Nothing planned{isToday ? " yet" : " for this day"}</div>
          <div>Add the few blocks that matter. When something doesn't happen, log why and set a fix so next time goes better.</div>
          <div className="row center">
            <button className="btn primary" onClick={() => open({ type: "block", date })}>Add a block</button>
            <button className="btn" onClick={() => open({ type: "routine" })}>Add a routine</button>
          </div>
        </div>
      ) : (
        <div className="grid">
          <section>
            <div className="sechead"><h2>Day</h2><button className="btn primary small" onClick={() => open({ type: "block", date })}>Add block</button></div>
            <Timeline tasks={tasks} cues={cues} lowDay={lowDay} isToday={isToday} />
          </section>
          <aside className="side">
            {isToday && <NowCard tasks={tasks} now={now} />}
            <CuesCard cues={cues} now={isToday ? now : -1} />
            <DayScore tasks={tasks} />
          </aside>
        </div>
      )}
    </>
  );
}

function NowCard({ tasks, now }: { tasks: Task[]; now: number }) {
  const { open } = useApp();
  const openTasks = tasks.filter((t) => t.status === "open");
  const cur = openTasks.find((t) => toMin(t.start) <= now && now < toMin(t.start) + t.dur);
  const next = openTasks.find((t) => toMin(t.start) > now);
  if (cur) {
    const p = Math.round(((now - toMin(cur.start)) / cur.dur) * 100);
    return (
      <div className="card now" style={{ "--c": `var(--c-${cur.category})` } as CSSProperties}>
        <h2>Now</h2><div className="what">{cur.title}</div>
        <div className="bar"><i style={{ width: `${p}%` }} /></div>
        <div className="when">{toMin(cur.start) + cur.dur - now} min left · ends {fmt(toMin(cur.start) + cur.dur)}</div>
        {next && <div className="small muted" style={{ marginTop: 10 }}>Next: {next.title} at {next.start}</div>}
        <div className="actions"><button className="btn small" onClick={() => open({ type: "log", task: cur })}>Log it</button></div>
      </div>
    );
  }
  if (next) {
    const gap = toMin(next.start) - now;
    return (
      <div className="card now"><h2>Up next</h2><div className="what">{next.title}</div>
        <div className="when">in {fmtDur(gap)} · {next.start}</div>
        {gap <= 10 && <div className="banner calm" style={{ marginTop: 12 }}><b>Transition.</b><span>Wrap up and stand up now.</span></div>}
        {next.ifNot && <div className="small muted" style={{ marginTop: 10 }}>If not: {next.ifNot}</div>}
      </div>
    );
  }
  return (
    <div className="card now"><h2>Now</h2><div className="what">{openTasks.length ? "Log what happened" : "Day closed"}</div>
      <div className="small muted">{openTasks.length ? `${openTasks.length} block${openTasks.length > 1 ? "s" : ""} still unlogged. Tap one on the timeline.` : "Everything is logged. Check Patterns to see what's working."}</div>
    </div>
  );
}

function CuesCard({ cues, now }: { cues: ReturnType<typeof cuesFor>; now: number }) {
  const fixes = cues.filter((c) => c.kind === "fix");
  if (!fixes.length) return null;
  return (
    <div className="card"><h2>Reminders</h2>
      <ul className="list">
        {fixes.map((c) => (
          <li key={c.key} style={{ opacity: c.at < now ? 0.5 : 1 }}>
            <span className="time">{fmt(c.at)}</span>
            <span className="grow">{c.text}
              <div className="small muted">for {c.tomorrow ? "tomorrow's " : ""}{c.forTask}{c.barrier && ` · after “${BARRIER_LABEL[c.barrier]}”`}</div>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayScore({ tasks }: { tasks: Task[] }) {
  const { state } = useApp();
  const mx = multiplier(state);
  return (
    <div className="card"><h2>This day</h2>
      <ul className="list">
        <li><span className="grow">Followed through</span><span className="time">{tasks.filter(isWin).length}/{tasks.length}</span></li>
        <li><span className="grow">Logged</span><span className="time">{tasks.filter((t) => t.status !== "open").length}/{tasks.length}</span></li>
        <li><span className="grow">Planned</span><span className="time">{fmtDur(tasks.reduce((a, t) => a + t.dur, 0))}</span></li>
        {mx && <li><span className="grow">Your time multiplier</span><span className="time">{mx.toFixed(1)}×</span></li>}
      </ul>
    </div>
  );
}
