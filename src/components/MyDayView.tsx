import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useApp } from "../ctx";
import { CATEGORIES, INSTEAD } from "../constants";
import type { Actual, InsteadKey, Task } from "../types";
import { addDays, fmt, fmtDur, fmtShort, toMin, today, uid } from "../lib/time";
import { tasksFor } from "../lib/plan";
import { actualsFor, daySummary } from "../lib/actuals";
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

export function MyDayView() {
  const { state, date, setDate, open, now } = useApp();
  const isToday = date === today();
  const plan = tasksFor(state, date);
  const acts = actualsFor(state, date);
  const sum = daySummary(state, date, isToday ? now : 1440);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [night, setNight] = useState(false);
  const hrs = state.dayHours || { start: "07:00", end: "23:00" };
  const fl = (m: number) => Math.floor(m / 60) * 60;
  const cl = (m: number) => Math.ceil(m / 60) * 60;
  const from = night ? 0 : Math.max(0, Math.min(fl(toMin(hrs.start)), ...plan.map((t) => fl(toMin(t.start))), ...acts.map((a) => fl(a.start)), ...(isToday ? [fl(now)] : [])));
  const to = night ? 1440 : Math.min(1440, Math.max(cl(toMin(hrs.end)), ...plan.map((t) => cl(toMin(t.start) + t.dur)), ...acts.map((a) => cl(a.end ?? now)), ...(isToday ? [cl(now + 1)] : [])));
  const y = (m: number) => ((m - from) / 60) * HOUR;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = Math.min(...plan.map((t) => toMin(t.start)), ...acts.map((a) => a.start), 8 * 60);
    el.scrollTop = Math.max(0, y(isToday ? now - 120 : first - 30));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, from]);

  const endOf = (a: Actual) => a.end ?? (isToday ? now : a.start + 15);
  const P = lanesOf(plan, (t) => toMin(t.start), (t) => toMin(t.start) + t.dur);
  const A = lanesOf(acts, (a) => a.start, endOf);

  const addAt = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = from + Math.floor(((e.clientY - r.top) / HOUR) * 4) * 15;
    const cover = plan.find((t) => toMin(t.start) <= m && m < toMin(t.start) + t.dur);
    open({ type: "entry", date, start: cover ? toMin(cover.start) : m, end: cover ? toMin(cover.start) + cover.dur : m + 30 });
  };

  const pct = (n: number) => (sum.planned ? Math.round((n / sum.planned) * 100) : 0);
  return (
    <>
      <div className="daynav">
        <button className="btn ghost small" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        {!isToday && <button className="btn small" onClick={() => setDate(today())}>Back to today</button>}
        <button className="btn ghost small" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
        <span className="spacer" />
        <button className="btn primary small" onClick={() => open({ type: "entry", date, start: isToday ? Math.max(0, now - 30) : 9 * 60, end: isToday ? now : 9 * 60 + 30 })}>Log something</button>
      </div>

      {isToday && <NowDoing current={plan.find((t) => toMin(t.start) <= now && now < toMin(t.start) + t.dur)} />}

      <div className="card mysum">
        <div className="sumrow">
          <div><b>{fmtDur(sum.planned)}</b><span>planned</span></div>
          <div className="ok"><b>{fmtDur(sum.onPlan)}</b><span>went as planned · {pct(sum.onPlan)}%</span></div>
          <div className="off"><b>{fmtDur(sum.instead)}</b><span>something else instead</span></div>
          <div><b>{fmtDur(sum.free)}</b><span>outside the plan</span></div>
          <div className="gap"><b>{fmtDur(sum.unlogged)}</b><span>planned, not logged yet</span></div>
        </div>
        <div className="catcmp">
          {CATEGORIES.map((c) => {
            const v = sum.byCat(c.key);
            const max = Math.max(60, ...CATEGORIES.map((x) => Math.max(sum.byCat(x.key).planned, sum.byCat(x.key).actual)));
            if (!v.planned && !v.actual) return null;
            return (
              <div key={c.key} className="catrow" style={{ "--c": `var(--c-${c.key})` } as CSSProperties}>
                <span className="lbl2">{c.label}</span>
                <span className="pair">
                  <i className="pl" style={{ width: `${(v.planned / max) * 100}%` }} />
                  <i className="ac" style={{ width: `${(v.actual / max) * 100}%` }} />
                </span>
                <span className="time">{fmtShort(v.actual)} of {fmtShort(v.planned)}</span>
              </div>
            );
          })}
          <div className="legend small"><span><i className="key pl" /> planned</span><span><i className="key ac" /> actually done</span></div>
        </div>
      </div>

      <div className="twocol-head"><span /><span>Planned</span><span>What really happened</span></div>
      <div className="tlscroll" ref={scrollRef}>
        <div className="mytl" style={{ height: y(to) + 2 }}>
          {Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60).map((m) => (
            <div key={m} className={`hour ${m % 360 === 0 ? "major" : ""}`} style={{ top: y(m) }}>{m < to ? fmt(m) : ""}</div>
          ))}
          {isToday && now >= from && now <= to && <div className="nowline" style={{ top: y(now) }} />}
          <div className="col plan">
            {plan.map((t) => (
              <button key={t.id} className={`block s-${t.status}`} onClick={() => open({ type: "log", task: t })}
                style={{ top: y(toMin(t.start)) + 1, height: Math.max(22, (t.dur / 60) * HOUR - 3), left: `${(P.lane[t.id] / P.n) * 100}%`, width: `calc(${100 / P.n}% - 4px)`, "--c": `var(--c-${t.category})` } as CSSProperties}>
                <span className="t">{t.title}</span>
              </button>
            ))}
          </div>
          <div className="col act" onClick={addAt} title="Tap to log what you did">
            {acts.map((a) => {
              const end = endOf(a);
              return (
                <button key={a.id} className={`entry k-${a.kind} ${a.end === undefined ? "running" : ""}`} onClick={() => open({ type: "entry", date, entry: a })}
                  style={{ top: y(a.start) + 1, height: Math.max(22, ((end - a.start) / 60) * HOUR - 3), left: `${(A.lane[a.id] / A.n) * 100}%`, width: `calc(${100 / A.n}% - 4px)`, "--c": a.category ? `var(--c-${a.category})` : "var(--muted)" } as CSSProperties}>
                  <span className="t">{a.title}</span>
                  {(end - a.start) / 60 * HOUR > 36 && <span className="m">{fmt(a.start)}–{a.end === undefined ? "now" : fmt(end)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {(night || from > 0 || to < 1440) && (
        <button className="btn ghost small nightbtn" onClick={() => setNight(!night)}>{night ? "Fold the night away" : "Show night hours"}</button>
      )}
      <div className="hint">Logging a block on the Plan view fills this in for you. Tap an empty spot on the right to add anything else you did.</div>
    </>
  );
}

/** One-tap "what am I doing right now" tracker. Starting something new stops the last one. */
function NowDoing({ current }: { current?: Task }) {
  const { state, update, now, toast } = useApp();
  const [text, setText] = useState("");
  const running = state.actuals.find((a) => a.end === undefined && a.date === today());

  const start = (entry: Omit<Actual, "id" | "date" | "start">) => {
    update((s) => {
      for (const a of s.actuals) if (a.end === undefined) a.end = Math.max(a.start + 1, now);
      s.actuals.push({ id: uid(), date: today(), start: now, ...entry });
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
