import { forwardRef, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { useApp } from "../ctx";
import type { Cue, Task } from "../types";
import { fmt, toMin } from "../lib/time";
import { materialize } from "../lib/plan";

export const HOUR = 56;
export const SNAP = 15;
export const snap = (m: number) => Math.round(m / SNAP) * SNAP;

type Drag = { id: string; mode: "move" | "resize"; y0: number; scroll0: number; start: number; dur: number; moved: boolean };

interface Props {
  tasks: Task[];
  cues: Cue[];
  lowDay: boolean;
  isToday: boolean;
  reorg: boolean;
  /** when a tray item is selected, clicking an empty slot places it there */
  onSlot: (minute: number) => void;
}

/** The whole 24-hour day in a scrolling column. In reorganize mode, blocks can be dragged and resized. */
export const Timeline = forwardRef<HTMLDivElement, Props>(function Timeline({ tasks, cues, lowDay, isToday, reorg, onSlot }, innerRef) {
  const { open, update, now, date } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const y = (m: number) => (m / 60) * HOUR;

  // open the day scrolled to "now" (today) or the first block
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = tasks.length ? Math.min(...tasks.map((t) => toMin(t.start))) : 8 * 60;
    const target = isToday ? now - 90 : first - 30;
    el.scrollTop = Math.max(0, y(target));
    // only when the day changes, not on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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

  const slotClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSlot(Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30);
  };

  // drag to move / resize (reorganize mode)
  const down = (e: PointerEvent<HTMLButtonElement>, t: Task) => {
    if (!reorg) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const mode = (e.target as HTMLElement).dataset.handle ? "resize" : "move";
    setDrag({ id: t.id, mode, y0: e.clientY, scroll0: scrollRef.current?.scrollTop || 0, start: toMin(t.start), dur: t.dur, moved: false });
  };
  const move = (e: PointerEvent<HTMLButtonElement>, t: Task) => {
    if (!drag || drag.id !== t.id) return;
    const sc = scrollRef.current!;
    const r = sc.getBoundingClientRect();
    if (e.clientY < r.top + 40) sc.scrollTop -= 10;
    else if (e.clientY > r.bottom - 40) sc.scrollTop += 10;
    const dy = e.clientY - drag.y0 + (sc.scrollTop - drag.scroll0);
    const delta = snap((dy / HOUR) * 60);
    const s0 = toMin(t.start);
    if (drag.mode === "move") {
      const start = Math.min(1440 - t.dur, Math.max(0, s0 + delta));
      setDrag({ ...drag, start, moved: drag.moved || Math.abs(dy) > 4 });
    } else {
      const dur = Math.max(SNAP, Math.min(1440 - s0, t.dur + delta));
      setDrag({ ...drag, dur, moved: drag.moved || Math.abs(dy) > 4 });
    }
  };
  const up = (t: Task) => {
    if (!drag || drag.id !== t.id) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return open({ type: "block", date, task: t });
    update((s) => {
      const real = materialize(s, t);
      real.start = fmt(d.start);
      real.dur = d.dur;
    });
  };
  const toTray = (t: Task) => update((s) => { materialize(s, t).unplaced = true; });

  const hours = Array.from({ length: 25 }, (_, h) => h * 60);
  return (
    <div className={`tlscroll ${reorg ? "reorg" : ""}`} ref={scrollRef}>
      <div className="timeline" ref={innerRef} style={{ height: y(1440) + 2 }} onClick={slotClick}>
        {hours.map((m) => <div key={m} className={`hour ${m % 360 === 0 ? "major" : ""}`} style={{ top: y(m) }}>{m < 1440 ? fmt(m) : ""}</div>)}
        {isToday && (
          <>
            <div className="passed" style={{ height: y(now) }} />
            <div className="nowline" style={{ top: y(now) }} />
          </>
        )}
        {tasks.map((t) => {
          const live = drag?.id === t.id ? drag : null;
          const s = live ? live.start : toMin(t.start);
          const dur = live ? live.dur : t.dur;
          const h = Math.max(24, (dur / 60) * HOUR - 3);
          const dim = lowDay && t.energy === "high" && t.status === "open";
          const sub =
            live ? `${fmt(s)}–${fmt(s + dur)} · ${dur} min`
            : t.status === "ifnot" ? "'If not' version done"
            : t.status === "partial" ? `Partly done${t.instead?.what.length ? " · rest went elsewhere" : ""}`
            : t.status === "missed" ? "Missed"
            : dim && t.ifNot ? `If not: ${t.ifNot}`
            : `${fmt(s)}–${fmt(s + dur)}`;
          const style = {
            top: y(s) + 1, height: h,
            left: `calc(56px + (100% - 64px - ${reorg ? "0px" : "30%"}) * ${lane[t.id] / L})`,
            width: `calc((100% - 64px - ${reorg ? "0px" : "30%"}) / ${L} - 4px)`,
            "--c": `var(--c-${t.category})`,
          } as CSSProperties;
          const cls = [
            "block",
            t.status === "done" || t.status === "ifnot" ? "done" : "",
            t.status === "missed" ? "missed" : "",
            t.status === "partial" ? "partial" : "",
            dim ? "dim" : "",
            live ? "dragging" : "",
          ].join(" ");
          return (
            <button key={t.id} style={style} className={cls}
              onClick={() => !reorg && open({ type: "log", task: t })}
              onPointerDown={(e) => down(e, t)} onPointerMove={(e) => move(e, t)} onPointerUp={() => up(t)} onPointerCancel={() => setDrag(null)}>
              <span className="t">
                {t.routineId && <span className="rt" title="Routine">↻</span>}
                {t.title}
                {t.ex && !reorg && <span className="chip ex">example</span>}
              </span>
              {h > 34 && <span className="m">{sub}</span>}
              {reorg && (
                <>
                  <span className="totray" role="button" aria-label="Move to tray" title="Move to tray"
                    onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toTray(t); }}>↥</span>
                  <span className="handle" data-handle="1" aria-hidden="true" />
                </>
              )}
            </button>
          );
        })}
        {!reorg && cues.filter((c) => c.kind === "fix").map((c) => (
          <div key={c.key} className="cue" style={{ top: y(c.at) }} title={c.text}>{fmt(c.at)} {c.text}</div>
        ))}
      </div>
    </div>
  );
});
