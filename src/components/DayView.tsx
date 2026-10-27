import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useApp } from "../ctx";
import { BARRIER_LABEL, INSTEAD_LABEL } from "../constants";
import type { Task } from "../types";
import { addDays, DAY_SHORT, fmt, fmtDur, norm, nowMin, parseKey, toMin, today, uid, weekday } from "../lib/time";
import { cuesFor, materialize, needsLog, notesFor, tasksFor, unplacedFor } from "../lib/plan";
import { isWin } from "../lib/stats";
import { HOUR, snap, Timeline } from "./Timeline";

type TrayItem = { kind: "note" | "task"; id: string; title: string; dur: number };
type Ghost = TrayItem & { x: number; y: number; moved: boolean };

export function DayView({ notificationsOn }: { notificationsOn: boolean }) {
  const { state, update, date, setDate, open, now, toast } = useApp();
  const isToday = date === today();
  const ci = state.checkins[date] || {};
  const tasks = tasksFor(state, date);
  const cues = cuesFor(state, date);
  const lowDay = ci.energy === "low" || (ci.sleep !== undefined && ci.sleep < 6);
  const [reorg, setReorg] = useState(false);
  const [selected, setSelected] = useState<TrayItem | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [night, setNight] = useState(false);

  // show your usual hours (plus anything planned outside them); the night folds away
  const hrs = state.dayHours || { start: "07:00", end: "23:00" };
  const floorH = (m: number) => Math.floor(m / 60) * 60;
  const ceilH = (m: number) => Math.ceil(m / 60) * 60;
  const from = night ? 0 : Math.max(0, Math.min(floorH(toMin(hrs.start)), ...tasks.map((t) => floorH(toMin(t.start))), ...(isToday ? [floorH(now)] : [])));
  const to = night ? 1440 : Math.min(1440, Math.max(ceilH(toMin(hrs.end)), ...tasks.map((t) => ceilH(toMin(t.start) + t.dur)), ...(isToday ? [ceilH(now + 1)] : [])));


  // place a tray item (post-it or parked block) at a time on the day
  const place = (item: TrayItem, minute: number) => {
    const start = fmt(Math.min(1440 - item.dur, Math.max(0, snap(minute))));
    update((s) => {
      if (item.kind === "note") {
        s.notes = s.notes.filter((n) => n.id !== item.id);
        s.tasks.push({ id: uid(), date, title: item.title, start, dur: item.dur, category: "work", status: "open" });
      } else {
        const t = s.tasks.find((x) => x.id === item.id);
        if (t) { t.start = start; t.unplaced = false; }
      }
    });
    setSelected(null);
    toast(`Placed “${item.title}” at ${start}.`);
  };
  const minuteAt = (clientX: number, clientY: number) => {
    const inner = timelineRef.current;
    const box = inner?.parentElement?.getBoundingClientRect();
    if (!inner || !box || clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) return null;
    return from + ((clientY - inner.getBoundingClientRect().top) / HOUR) * 60;
  };
  const onSlot = (minute: number) => {
    if (selected) place(selected, minute);
    else open({ type: "block", date, start: fmt(minute) });
  };

  // dragging from the tray / post-its onto the timeline
  const dragStart = (e: PointerEvent<HTMLElement>, item: TrayItem) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setGhost({ ...item, x: e.clientX, y: e.clientY, moved: false });
  };
  const dragMove = (e: PointerEvent<HTMLElement>) => {
    if (!ghost) return;
    const sc = timelineRef.current?.parentElement;
    const r = sc?.getBoundingClientRect();
    if (sc && r && e.clientX > r.left && e.clientX < r.right) {
      if (e.clientY < r.top + 40 && e.clientY > r.top) sc.scrollTop -= 10;
      else if (e.clientY > r.bottom - 40 && e.clientY < r.bottom) sc.scrollTop += 10;
    }
    const moved = ghost.moved || Math.hypot(e.clientX - ghost.x, e.clientY - ghost.y) > 6;
    setGhost({ ...ghost, x: e.clientX, y: e.clientY, moved });
  };
  const dragEnd = (e: PointerEvent<HTMLElement>) => {
    if (!ghost) return;
    const g = ghost;
    setGhost(null);
    if (!g.moved) {
      setSelected((cur) => (cur?.id === g.id ? null : g));
      return;
    }
    const m = minuteAt(e.clientX, e.clientY);
    if (m !== null) place(g, m - g.dur / 2);
  };
  const drag = { start: dragStart, move: dragMove, end: dragEnd };

  const clearRest = () => {
    const from = isToday ? nowMin() : -1;
    let n = 0;
    update((s) => {
      for (const t of tasksFor(s, date)) {
        if (t.status === "open" && toMin(t.start) >= from) { materialize(s, t).unplaced = true; n++; }
      }
    });
    toast(n ? `${n} block${n > 1 ? "s" : ""} moved to the tray. Drag them back where they fit.` : "No open blocks left to move.");
  };

  // "never miss twice": same block missed the day before
  const missedYesterday = state.tasks.filter((t) => t.date === addDays(date, -1) && t.status === "missed");
  const repeat = missedYesterday.find((m) => tasks.some((t) => norm(t.title) === norm(m.title)));
  const toLog = date <= today() ? tasks.filter((t) => needsLog(t, date, today(), now)) : [];
  const tray = unplacedFor(state, date);

  return (
    <>
      <div className="daynav">
        <button className="btn ghost small" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        {!isToday && <button className="btn small" onClick={() => setDate(today())}>Back to today</button>}
        <button className="btn ghost small" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
      </div>

      <CheckinRow date={date} isToday={isToday} tasks={tasks} notificationsOn={notificationsOn} />

      {toLog.length > 0 ? (
        <div className="banner">
          <b>{toLog.length} block{toLog.length > 1 ? "s" : ""} ended without a log.</b>
          <span>Logging what really happened takes a few seconds and shows where your time goes.</span>
          <button className="btn small" onClick={() => open({ type: "log", task: toLog[0] })}>Log “{toLog[0].title}”</button>
        </div>
      ) : repeat ? (
        <div className="banner"><b>Never miss twice.</b><span>You missed “{repeat.title}” yesterday{repeat.barrier && ` (${BARRIER_LABEL[repeat.barrier].toLowerCase()})`}. Today, even the “if not” version counts.</span></div>
      ) : lowDay ? (
        <div className="banner calm"><b>Low-fuel day.</b><span>High-energy blocks are dimmed. Do their “if not” versions and protect one win.</span></div>
      ) : null}

      <div className="grid">
        <section>
          <div className="sechead">
            <h2>{parseKey(date).toLocaleDateString(undefined, { weekday: "long" })}</h2>
            <div className="row tight">
              <button className={`btn small ${reorg ? "primary" : ""}`} onClick={() => { setReorg(!reorg); setSelected(null); }}>
                {reorg ? "Done reorganizing" : "Reorganize"}
              </button>
              {!reorg && <button className="btn primary small" onClick={() => open({ type: "block", date })}>Add block</button>}
            </div>
          </div>
          {reorg && (
            <div className="banner calm reorgbar">
              <span>Drag a block to move it. Drag its bottom edge to change the length. <b>↥</b> sends it to the tray.</span>
              <button className="btn small" onClick={clearRest}>{isToday ? "Clear the rest of today" : "Clear the whole day"}</button>
            </div>
          )}
          {selected && <div className="hint placing">Tap a time on the day to place “{selected.title}”. <button className="linkbtn" onClick={() => setSelected(null)}>Cancel</button></div>}
          <Timeline ref={timelineRef} tasks={tasks} cues={cues} lowDay={lowDay} isToday={isToday} reorg={reorg} onSlot={onSlot} from={from} to={to} />
          {(night || from > 0 || to < 1440) && (
            <button className="btn ghost small nightbtn" onClick={() => setNight(!night)}>
              {night ? "Fold the night away" : `Show night hours (before ${fmt(from)}, after ${fmt(to % 1440)})`}
            </button>
          )}
          {!tasks.length && !reorg && (
            <div className="hint">Nothing on the timeline yet. Tap any time to add a block, or use the + button.</div>
          )}
        </section>
        <aside className="side">
          {isToday && <NowCard tasks={tasks} now={now} />}
          <TodoCard date={date} isToday={isToday} tray={tray} drag={drag} selected={selected} />
          <CuesCard cues={cues} now={isToday ? now : -1} />
        </aside>
      </div>

      {ghost?.moved && (
        <div className="dragghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.title} · {ghost.dur} min</div>
      )}
    </>
  );
}

function TodoCard({ date, isToday, tray, drag, selected }: {
  date: string; isToday: boolean; tray: Task[]; selected: TrayItem | null;
  drag: { start: (e: PointerEvent<HTMLElement>, i: TrayItem) => void; move: (e: PointerEvent<HTMLElement>) => void; end: (e: PointerEvent<HTMLElement>) => void };
}) {
  const { state, update, open, celebrate } = useApp();
  const [text, setText] = useState("");
  const notes = notesFor(state, date, isToday);
  const add = () => {
    const t = text.trim();
    if (!t) return;
    update((s) => { s.notes.push({ id: uid(), date, text: t, done: false }); });
    setText("");
  };
  const toggle = (id: string) => {
    const wasDone = state.notes.find((x) => x.id === id)?.done;
    update((s) => { const n = s.notes.find((x) => x.id === id)!; n.done = !n.done; n.doneDate = n.done ? today() : undefined; });
    if (!wasDone) celebrate();
  };
  const remove = (id: string) => update((s) => { s.notes = s.notes.filter((x) => x.id !== id); });
  const nudge = (id: string, by: number) =>
    update((s) => { const t = s.tasks.find((x) => x.id === id)!; t.dur = Math.max(15, t.dur + by); });
  const handle = (item: TrayItem) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => drag.start(e, item),
    onPointerMove: drag.move,
    onPointerUp: drag.end,
  });

  return (
    <div className="card postit">
      <div className="sechead"><h2>To do {isToday ? "today" : DAY_SHORT[weekday(date)]}</h2><span className="small muted">{notes.filter((n) => !n.done).length} open</span></div>
      <div className="addnote">
        <input id="note-new" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a to-do… (Enter)" aria-label="New to-do" />
      </div>
      <ul className="notes">
        {notes.map((n) => (
          <li key={n.id} className={`${n.done ? "done" : ""} ${selected?.id === n.id ? "sel" : ""}`}>
            <input type="checkbox" checked={n.done} onChange={() => toggle(n.id)} aria-label={`Done: ${n.text}`} />
            <span className="grow">{n.text}{n.date < date && !n.done && <span className="chip">since {DAY_SHORT[weekday(n.date)]}</span>}</span>
            {!n.done && (
              <>
                <button className="iconbtn" title="Give it a time" aria-label="Give it a time"
                  onClick={() => open({ type: "block", date, title: n.text, fromNote: n.id })}>⏱</button>
                <span className="grip" title="Drag onto the day, or tap then tap a time" {...handle({ kind: "note", id: n.id, title: n.text, dur: 30 })}>⋮⋮</span>
              </>
            )}
            {n.done && <button className="iconbtn" aria-label="Remove" onClick={() => remove(n.id)}>×</button>}
          </li>
        ))}
      </ul>
      {!notes.length && <div className="small muted">Quick things with no set time. Drag one onto the day when you're ready to do it.</div>}

      {tray.length > 0 && (
        <>
          <h2 style={{ marginTop: 16 }}>Tray · drag back onto the day</h2>
          <ul className="notes tray">
            {tray.map((t) => (
              <li key={t.id} className={selected?.id === t.id ? "sel" : ""} style={{ "--c": `var(--c-${t.category})` } as CSSProperties}>
                <span className="swatch" />
                <span className="grow">{t.routineId && <span className="rt">↻</span>}{t.title}</span>
                <span className="durctl">
                  <button className="iconbtn" aria-label="15 minutes shorter" onClick={() => nudge(t.id, -15)}>−</button>
                  <span className="time">{fmtDur(t.dur)}</span>
                  <button className="iconbtn" aria-label="15 minutes longer" onClick={() => nudge(t.id, 15)}>+</button>
                </span>
                <span className="grip" title="Drag onto the day, or tap then tap a time" {...handle({ kind: "task", id: t.id, title: t.title, dur: t.dur })}>⋮⋮</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NowCard({ tasks, now }: { tasks: Task[]; now: number }) {
  const { open, update, toast } = useApp();
  const openTasks = tasks.filter((t) => t.status === "open");
  const cur = openTasks.find((t) => toMin(t.start) <= now && now < toMin(t.start) + t.dur);
  const next = openTasks.find((t) => toMin(t.start) > now);
  if (cur) {
    const p = Math.round(((now - toMin(cur.start)) / cur.dur) * 100);
    const last = cur.checks?.[cur.checks.length - 1];
    const onIt = () => {
      update((s) => { const t = materialize(s, cur); (t.checks ||= []).push({ at: now, on: true }); });
      toast("Nice. Keep going.");
    };
    return (
      <div className="card now" style={{ "--c": `var(--c-${cur.category})` } as CSSProperties}>
        <h2>Now</h2><div className="what">{cur.title}</div>
        <div className="bar"><i style={{ width: `${p}%` }} /></div>
        <div className="when">{toMin(cur.start) + cur.dur - now} min left · ends {fmt(toMin(cur.start) + cur.dur)}</div>
        {!last && p >= 40 && (
          <div className="checkin-q">
            <span>Halfway check: still on it?</span>
            <div className="row tight">
              <button className="btn small light" onClick={onIt}>On it</button>
              <button className="btn small" onClick={() => open({ type: "check", task: cur })}>Doing something else</button>
            </div>
          </div>
        )}
        {last && !last.on && (
          <div className="small muted" style={{ marginTop: 10 }}>
            Checked in at {fmt(last.at)}: {(last.what || []).map((k) => INSTEAD_LABEL[k].toLowerCase()).join(", ") || "off track"}.
            {cur.ifNot && <> Back on track with the “if not” version: {cur.ifNot}.</>}
          </div>
        )}
        {next && <div className="small muted" style={{ marginTop: 10 }}>Next: {next.title} at {next.start}</div>}
        <div className="actions"><button className="btn small light" onClick={() => open({ type: "log", task: cur })}>Log it</button></div>
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
  if (!tasks.length) {
    return (
      <div className="card now"><h2>Now</h2><div className="what">Open time</div>
        <div className="small muted">Nothing planned. Tap a time on the day to add a block, or drag a to-do onto it.</div></div>
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

/** Morning check-in as a small card once a day; afterwards just chips you can tap to change. */
function CheckinRow({ date, isToday, tasks, notificationsOn }: { date: string; isToday: boolean; tasks: Task[]; notificationsOn: boolean }) {
  const { state, update, open } = useApp();
  const ci = state.checkins[date] || {};
  const [editing, setEditing] = useState(false);
  const set = (patch: Partial<typeof ci>) => update((s) => { s.checkins[date] = { ...(s.checkins[date] || {}), ...patch }; });
  const done = tasks.filter(isWin).length;
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

  if (editing || (isToday && !ci.energy && !ci.skipped)) {
    return (
      <div className="card morning" aria-label="Daily check-in">
        <div className="what">{editing ? "Update your check-in" : "Morning check-in · 5 seconds"}</div>
        <div><label className="lbl" htmlFor="sleep">Slept</label>
          <input className="sleep" id="sleep" type="number" min={0} max={14} step={0.5} placeholder="7"
            value={ci.sleep ?? ""} onChange={(e) => set({ sleep: e.target.value === "" ? undefined : +e.target.value })} /> <span className="muted small">h</span></div>
        <div><span className="lbl">Energy</span>
          <span className="seg">
            {(["low", "steady", "high"] as const).map((e) => (
              <button key={e} aria-pressed={ci.energy === e} onClick={() => { set({ energy: e }); setEditing(false); }}>{cap(e)}</button>
            ))}
          </span></div>
        <span className="spacer" />
        <button className="btn ghost small" onClick={() => { if (!ci.energy) set({ skipped: true }); setEditing(false); }}>{ci.energy ? "Done" : "Skip today"}</button>
      </div>
    );
  }
  return (
    <div className="chiprow">
      <button className="chipbtn" onClick={() => setEditing(true)}>Energy · {ci.energy ? cap(ci.energy) : "not set"}</button>
      {ci.sleep !== undefined && <button className="chipbtn" onClick={() => setEditing(true)}>Slept {ci.sleep} h</button>}
      {tasks.length > 0 && <span className="chipbtn good">{done} of {tasks.length} done</span>}
      {!notificationsOn && <button className="chipbtn" onClick={() => open({ type: "setup" })}>Turn on reminders</button>}
    </div>
  );
}
