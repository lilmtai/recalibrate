import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useApp } from "../ctx";
import { categoriesOf, INSTEAD } from "../constants";
import type { Actual, InsteadKey, Task } from "../types";
import { addDays, fmt, fmtDur, fmtShort, toMin, today, uid } from "../lib/time";
import { materialize, tasksFor } from "../lib/plan";
import { markStarted } from "../lib/actions";
import { actualsFor } from "../lib/actuals";
import { fetchDay, historyInTable, KEEP_DAYS } from "../useHistory";
import { HOUR } from "./Timeline";

const QUICK: InsteadKey[] = ["phone", "otherwork", "people", "chores", "food", "rest"];

/** Lay out overlapping items side by side. */
function lanesOf<T extends { id: string }>(items: T[], start: (i: T) => number, end: (i: T) => number) {
  const lanes: number[] = [];
  const lane: Record<string, number> = {};
  for (const it of [...items].sort((a, b) => start(a) - start(b))) {
    let i = lanes.findIndex((e) => e <= start(it));
    if (i < 0) { i = lanes.length; lanes.push(0); }
    lanes[i] = end(it);
    lane[it.id] = i;
  }
  return { lane, n: Math.max(1, lanes.length) };
}

/**
 * My day: only what really happened. Filled by the hourly "What are you doing?",
 * by blocks you mark done / partly / not done, and anything you log yourself.
 */
export function MyDayView() {
  const { state, date, setDate, open, now } = useApp();
  const isToday = date === today();
  // days older than what the phone keeps come from the server (read-only)
  const [older, setOlder] = useState<Actual[] | null>(null);
  const isOld = date < addDays(today(), -KEEP_DAYS);
  useEffect(() => {
    setOlder(null);
    if (isOld && historyInTable()) fetchDay(date).then(setOlder);
  }, [date, isOld]);
  const acts = isOld && older ? older : actualsFor(state, date);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [night, setNight] = useState(false);
  const hrs = state.dayHours || { start: "07:00", end: "23:00" };
  const fl = (m: number) => Math.floor(m / 60) * 60;
  const cl = (m: number) => Math.ceil(m / 60) * 60;
  const wake = toMin(hrs.start);
  const from = night ? 0 : Math.max(0, Math.min(fl(wake), ...acts.map((a) => fl(a.start)), ...(isToday ? [fl(now)] : [])));
  const to = night ? 1440 : Math.min(1440, Math.max(cl(toMin(hrs.end)), ...acts.map((a) => cl(a.end ?? now)), ...(isToday ? [cl(now + 1)] : [])));
  const y = (m: number) => ((m - from) / 60) * HOUR;
  const endOf = (a: Actual) => a.end ?? (isToday ? now : a.start + 15);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, y(isToday ? now - 150 : wake));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, from]);

  // time by area, from what really happened
  const logged = acts.reduce((x, a) => x + Math.max(0, endOf(a) - a.start), 0);
  const byCat = categoriesOf(state).map((c) => ({ ...c, min: acts.filter((a) => a.category === c.key).reduce((x, a) => x + Math.max(0, endOf(a) - a.start), 0) }));
  const other = Math.max(0, logged - byCat.reduce((x, c) => x + c.min, 0));
  const max = Math.max(60, ...byCat.map((c) => c.min), other);

  // gaps of 30+ minutes between waking and now (or the end of the day) with nothing logged
  const until = isToday ? now : toMin(hrs.end);
  const gaps: { s: number; e: number }[] = [];
  let cursor = wake;
  for (const a of [...acts].sort((p, q) => p.start - q.start)) {
    if (a.start - cursor >= 30 && a.start <= until) gaps.push({ s: cursor, e: Math.min(a.start, until) });
    cursor = Math.max(cursor, endOf(a));
  }
  if (until - cursor >= 30 && date <= today()) gaps.push({ s: cursor, e: until });
  const gapMin = gaps.reduce((x, g) => x + g.e - g.s, 0);

  const L = lanesOf(acts, (a) => a.start, endOf);
  const addAt = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = from + Math.floor(((e.clientY - r.top) / HOUR) * 4) * 15;
    open({ type: "entry", date, start: m, end: m + 30 });
  };

  return (
    <>
      <div className="daynav">
        <button className="btn ghost small" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        {!isToday && <button className="btn small" onClick={() => setDate(today())}>Back to today</button>}
        <button className="btn ghost small" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
        <span className="spacer" />
        <button className="btn primary small" onClick={() => open({ type: "wyd", date })}>{isToday ? "Log the last hour" : "Log something"}</button>
      </div>

      {isToday && <NowDoing current={tasksFor(state, date).find((t) => toMin(t.start) <= now && now < toMin(t.start) + t.dur)} />}

      <div className="card mysum">
        <div className="sumrow two-up">
          <div className="ok"><b>{fmtDur(logged)}</b><span>logged {isToday ? "so far" : "this day"}</span></div>
          <div className="gap"><b>{fmtDur(gapMin)}</b><span>not logged yet{gaps.length ? " · tap a gap below" : ""}</span></div>
        </div>
        {logged > 0 && (
          <div className="catcmp">
            {byCat.filter((c) => c.min).map((c) => (
              <div key={c.key} className="catrow" style={{ "--c": `var(--c-${c.key})` } as CSSProperties}>
                <span>{c.label}</span>
                <span className="pair"><i className="ac" style={{ width: `${(c.min / max) * 100}%` }} /></span>
                <span className="time">{fmtShort(c.min)}</span>
              </div>
            ))}
            {other > 0 && (
              <div className="catrow">
                <span>Other</span>
                <span className="pair"><i className="ac" style={{ width: `${(other / max) * 100}%`, background: "var(--muted)" }} /></span>
                <span className="time">{fmtShort(other)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="tlscroll" ref={scrollRef} style={{ marginTop: 16 }}>
        <div className="mytl solo" style={{ height: y(to) + 2 }}>
          {Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60).map((m) => (
            <div key={m} className={`hour ${m % 360 === 0 ? "major" : ""}`} style={{ top: y(m) }}>{m < to ? fmt(m) : ""}</div>
          ))}
          {isToday && now >= from && now <= to && <div className="nowline" style={{ top: y(now) }} />}
          <div className="col act" onClick={addAt} title="Tap to log what you did">
            {gaps.filter((g) => g.e > from && g.s < to).map((g) => (
              <button key={`gap${g.s}`} className="gapblock" style={{ top: y(Math.max(g.s, from)) + 1, height: Math.max(22, ((Math.min(g.e, to) - Math.max(g.s, from)) / 60) * HOUR - 3) }}
                onClick={() => open({ type: "wyd", date, from: g.s, at: g.e })}>
                Not logged · {fmt(g.s)}–{fmt(g.e)} · tap to fill
              </button>
            ))}
            {acts.map((a) => {
              const end = endOf(a);
              return (
                <button key={a.id} className={`entry k-${a.kind} ${a.end === undefined ? "running" : ""}`} onClick={() => open({ type: "entry", date, entry: a })}
                  style={{ top: y(a.start) + 1, height: Math.max(22, ((end - a.start) / 60) * HOUR - 3), left: `${(L.lane[a.id] / L.n) * 100}%`, width: `calc(${100 / L.n}% - 4px)`, "--c": a.category ? `var(--c-${a.category})` : "var(--muted)" } as CSSProperties}>
                  <span className="t">{a.title}</span>
                  {((end - a.start) / 60) * HOUR > 36 && <span className="m">{fmt(a.start)}–{a.end === undefined ? "now" : fmt(end)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {(night || from > 0 || to < 1440) && (
        <button className="btn ghost small nightbtn" onClick={() => setNight(!night)}>{night ? "Fold the night away" : "Show night hours"}</button>
      )}
      <div className="hint">Filled by the hourly “What are you doing?”, by blocks you mark done or not done, and anything you add. Tap any empty spot to log something.</div>
    </>
  );
}

function NowDoing({ current }: { current?: Task }) {
  const { state, update, now, toast } = useApp();
  const [text, setText] = useState("");
  const running = state.actuals.find((a) => a.end === undefined && a.date === today());

  const start = (entry: Omit<Actual, "id" | "date" | "start">) => {
    update((s) => {
      for (const a of s.actuals) if (a.end === undefined) a.end = Math.max(a.start + 1, now);
      s.actuals.push({ id: uid(), date: today(), start: now, ...entry });
      // starting a planned block from "now doing" records its real start
      const t = entry.taskId && tasksFor(s, today()).find((x) => x.id === entry.taskId);
      if (t) markStarted(materialize(s, t));
    });
    setText("");
  };
  const stop = () => {
    update((s) => { const a = s.actuals.find((x) => x.id === running!.id); if (a) a.end = Math.max(a.start + 1, now); });
    toast("Stopped. It's on your My day timeline.");
  };
  const startText = () => text.trim() && start({ title: text.trim(), kind: current ? "instead" : "free" });

  if (running) {
    return (
      <div className="card nowdoing on">
        <div><h2>Now doing</h2><div className="what">{running.title}</div>
          <div className="when">since {fmt(running.start)} · {fmtDur(Math.max(0, now - running.start))}</div></div>
        <div className="row tight"><button className="btn primary small" onClick={stop}>Stop</button></div>
      </div>
    );
  }
  return (
    <div className="card nowdoing">
      <h2>What are you doing right now?</h2>
      <div className="chips">
        {current && (
          <button className="pick strong" onClick={() => start({ title: current.title, kind: "plan", category: current.category, taskId: current.id })}>
            ▶ {current.title} (planned)
          </button>
        )}
        {QUICK.map((k) => {
          const it = INSTEAD.find((i) => i.key === k)!;
          return <button key={k} className="pick" onClick={() => start({ title: it.label, kind: current ? "instead" : "free", insteadKey: k })}>{it.label}</button>;
        })}
      </div>
      <input id="nowdoing" className="nowinput" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startText()}
        placeholder="Or type it and press Enter" aria-label="What are you doing" />
    </div>
  );
}
