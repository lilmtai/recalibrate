import type { CSSProperties, MouseEvent } from "react";
import { useApp } from "../ctx";
import type { Cue, Task } from "../types";
import { fmt, toMin } from "../lib/time";

const HOUR = 56;

export function Timeline({ tasks, cues, lowDay, isToday }: { tasks: Task[]; cues: Cue[]; lowDay: boolean; isToday: boolean }) {
  const { open, date, now } = useApp();
  const starts = tasks.map((t) => toMin(t.start));
  const ends = tasks.map((t) => toMin(t.start) + t.dur);
  const from = Math.min(7 * 60, Math.floor(Math.min(...starts, 1440) / 60) * 60);
  const to = Math.max(22 * 60, Math.ceil(Math.max(...ends, 0) / 60) * 60);
  const y = (m: number) => ((m - from) / 60) * HOUR;

  // side-by-side lanes when blocks overlap
  const lanes: number[] = [];
  const lane: Record<string, number> = {};
  for (const t of tasks) {
    const s = toMin(t.start);
    let i = lanes.findIndex((e) => e <= s);
    if (i < 0) { i = lanes.length; lanes.push(0); }
    lanes[i] = s + t.dur;
    lane[t.id] = i;
  }
  const L = Math.max(1, lanes.length);

  const addAt = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const m = from + Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30;
    open({ type: "block", date, start: fmt(m) });
  };

  const hours = [];
  for (let m = from; m <= to; m += 60) hours.push(m);
  return (
    <div className="timeline" style={{ height: y(to) + 8 }} onClick={addAt} title="Click an empty slot to add a block">
      {hours.map((m) => <div key={m} className="hour" style={{ top: y(m) }}>{fmt(m)}</div>)}
      {isToday && now > from && now < to && (
        <>
          <div className="passed" style={{ height: y(now) }} />
          <div className="nowline" style={{ top: y(now) }} />
        </>
      )}
      {tasks.map((t) => {
        const s = toMin(t.start);
        const h = Math.max(26, (t.dur / 60) * HOUR - 3);
        const dim = lowDay && t.energy === "high" && t.status === "open";
        const sub =
          t.status === "ifnot" ? "'If not' version done"
          : t.status === "missed" ? "Missed"
          : dim && t.ifNot ? `If not: ${t.ifNot}`
          : `${fmt(s)}–${fmt(s + t.dur)}`;
        const style = {
          top: y(s) + 1, height: h,
          left: `calc(56px + (100% - 64px - 34%) * ${lane[t.id] / L})`,
          width: `calc((100% - 64px - 34%) / ${L} - 4px)`,
          "--c": `var(--c-${t.category})`,
        } as CSSProperties;
        return (
          <button key={t.id} style={style} onClick={() => open({ type: "log", task: t })}
            className={`block ${t.status === "done" || t.status === "ifnot" ? "done" : ""} ${t.status === "missed" ? "missed" : ""} ${dim ? "dim" : ""}`}>
            <span className="t">
              {t.routineId && <span className="rt" title="Routine">↻</span>}
              {t.title}
              {t.ex && <span className="chip ex">example</span>}
            </span>
            {h > 34 && <span className="m">{sub}</span>}
          </button>
        );
      })}
      {cues.filter((c) => c.kind === "fix" && c.at >= from).map((c) => (
        <div key={c.key} className="cue" style={{ top: y(c.at) }} title={c.text}>{fmt(c.at)} {c.text}</div>
      ))}
    </div>
  );
}
