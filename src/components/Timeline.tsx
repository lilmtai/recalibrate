import { forwardRef, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { useApp } from "../ctx";
import type { Cue, Task } from "../types";
import { fmt, fmtShort, parseKey, toMin } from "../lib/time";
import { materialize, shownDur } from "../lib/plan";
import { completeTask, moveTask, reopenTask } from "../lib/actions";
import { syncActuals } from "../lib/actuals";
import { suggestEmoji } from "../lib/emoji";
import { freeGaps, layoutLanes, lenLabel } from "../lib/dayLayout";
import { Icon } from "./Icon";

/** pixels per hour */
export const HOUR = 76;
export const SNAP = 15;
export const snap = (m: number) => Math.round(m / SNAP) * SNAP;
/** shortest a block is drawn (px); a 15-minute block still gets one readable line */
const MIN_H = 30;
/** 30-minute blocks and up get a second line for the times; 45 minutes and up get the full layout */
const MID = 35;
const TALL = 52;
const GUTTER = 52;

type Drag = { id: string; mode: "move" | "resize"; y0: number; scroll0: number; start: number; dur: number; moved: boolean };

interface Props {
  tasks: Task[];
  cues: Cue[];
  lowDay: boolean;
  isToday: boolean;
  reorg: boolean;
  /** placing something from the tray / to-dos: empty slots place it, free-time hints hide */
  placing?: boolean;
  /** clicking an empty slot */
  onSlot: (minute: number) => void;
  /** asked before a fixed block is moved; return false to cancel */
  confirmMove?: (t: Task) => boolean;
  /** visible window in minutes after midnight */
  from?: number;
  to?: number;
}

/**
 * The day, hour by hour. Each block shows its emoji pill, times and title, with a one-tap ✓ circle.
 * Free time between blocks says "tap to plan". In reorganize mode, blocks can be dragged and resized.
 */
export const Timeline = forwardRef<HTMLDivElement, Props>(function Timeline(
  { tasks, cues, lowDay, isToday, reorg, placing, onSlot, confirmMove, from = 0, to = 1440 }, innerRef,
) {
  const { state, open, update, now, date, toast, celebrate } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const y = (m: number) => ((m - from) / 60) * HOUR;
  const minDur = (MIN_H / HOUR) * 60;

  // open the day scrolled to "now" (today) or the first block
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = tasks.length ? Math.min(...tasks.map((t) => toMin(t.start))) : 8 * 60;
    const target = isToday ? now - 90 : first - 30;
    el.scrollTop = Math.max(0, y(target));
    // only when the day or the visible window changes, not on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, from]);

  const spans = tasks.map((t) => ({ id: t.id, start: toMin(t.start), dur: shownDur(t, isToday, now) }));
  const lanes = layoutLanes(spans, minDur);

  // free time worth planning: inside your day hours, and (today) only from now on
  const hrs = state.dayHours || { start: "07:00", end: "23:00" };
  const gapFrom = Math.max(toMin(hrs.start), from, isToday ? Math.ceil(now / 15) * 15 : 0);
  const gaps = reorg || placing ? [] : freeGaps(spans, gapFrom, Math.min(toMin(hrs.end), to), 30);

  const minuteAtY = (clientY: number, el: HTMLElement) => from + Math.floor(((clientY - el.getBoundingClientRect().top) / HOUR) * 4) * 15;
  const slotClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    onSlot(from + Math.floor(((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR) * 2) * 30);
  };

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

  // drag to move / resize (reorganize mode)
  const down = (e: PointerEvent<HTMLDivElement>, t: Task) => {
    if (!reorg) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const mode = (e.target as HTMLElement).dataset.handle ? "resize" : "move";
    setDrag({ id: t.id, mode, y0: e.clientY, scroll0: scrollRef.current?.scrollTop || 0, start: toMin(t.start), dur: t.dur, moved: false });
  };
  const move = (e: PointerEvent<HTMLDivElement>, t: Task) => {
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
    if (d.start === toMin(t.start) && d.dur === t.dur && d.moved) return;
    if (t.fixed && confirmMove && !confirmMove(t)) return;
    // a tap (no drag) lifts the block into the tray beside "Up next"
    if (!d.moved) return toTray(t);
    update((s) => moveTask(materialize(s, t), fmt(d.start), d.dur));
    // moving a routine block here changes this day only; the routine itself is edited in Me → Routines
  };
  const toTray = (t: Task) => update((s) => {
    const real = materialize(s, t);
    (real.moves ||= []).push({ at: new Date().toISOString(), from: real.start, to: "", source: "user" });
    real.unplaced = true;
  });

  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, h) => from + h * 60);
  return (
    <div className={`tlscroll ${reorg ? "reorg" : ""}`} ref={scrollRef}>
      <div className="timeline" ref={innerRef} style={{ height: y(to) + 2 }} onClick={slotClick}>
        {hours.map((m) => <div key={m} className={`hour ${m % 360 === 0 ? "major" : ""}`} style={{ top: y(m) }}>{m < to ? fmt(m) : ""}</div>)}
        {isToday && now >= from && now <= to && (
          <>
            <div className="passed" style={{ height: y(now) }} />
            <div className="nowline" style={{ top: y(now) }}><span>{fmt(now)}</span></div>
          </>
        )}
        {gaps.map((g) => {
          const top = y(g.from) + 3;
          const h = y(g.to) - y(g.from) - 6;
          return (
            <button key={`gap${g.from}`} className="gapfree" style={{ top, height: h, left: GUTTER + 4 }}
              onClick={(e) => open({ type: "block", date, start: fmt(Math.max(g.from, Math.min(g.to - 15, minuteAtY(e.clientY, e.currentTarget.parentElement!)))) })}>
              Free · {lenLabel(g.to - g.from)} · tap to plan
            </button>
          );
        })}
        {!reorg && cues.filter((c) => c.kind === "fix" && c.at >= from && c.at <= to).map((c) => (
          <div key={c.key} className="cue" style={{ top: y(c.at) }} title={c.text}><i />{c.text}</div>
        ))}
        {tasks.map((t) => {
          const live = drag?.id === t.id ? drag : null;
          const s = live ? live.start : toMin(t.start);
          const dur = live ? live.dur : shownDur(t, isToday, now);
          const h = Math.max(MIN_H, (dur / 60) * HOUR - 1);
          const tall = h >= TALL;
          const size = tall ? "tall" : h >= MID ? "mid" : "short";
          const dim = lowDay && t.energy === "high" && t.status === "open";
          const done = t.status === "done" || t.status === "ifnot";
          const running = state.focus?.taskId === t.id;
          const emoji = t.emoji || suggestEmoji(t.title, t.category, state);
          const { lane, of } = lanes[t.id] || { lane: 0, of: 1 };
          const meta =
            t.ongoing && t.status === "open" && !live
              ? `${t.start} – ongoing${isToday && now > s ? ` (${lenLabel(now - s)} so far)` : ""}`
              : `${fmt(s)} – ${fmt(s + dur)} (${lenLabel(dur)})`;
          const note =
            running ? <span className="bnote gold">Focusing now</span>
            : t.status === "missed" ? <span className="bnote warn">Didn't happen{t.barrier ? "" : " · tap to log why"}</span>
            : t.status === "partial" ? <span className="bnote">Partly done</span>
            : t.status === "ifnot" ? <span className="bnote">“If not” version done</span>
            : dim && t.ifNot ? <span className="bnote">If not: {t.ifNot}</span>
            : t.deadline && t.status === "open" ? <span className={`bnote ${t.deadline <= date ? "warn" : ""}`}>Due {t.deadline === date ? "today" : t.deadline < date ? "already" : parseKey(t.deadline).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>
            : null;
          const style = {
            top: y(s) + 1, height: h,
            left: `calc(${GUTTER}px + (100% - ${GUTTER + 6}px) * ${lane / of})`,
            width: `calc((100% - ${GUTTER + 6}px) / ${of} - 3px)`,
            "--c": `var(--c-${t.category})`,
          } as CSSProperties;
          const cls = [
            "block", size, `s-${t.status}`,
            dim ? "dim" : "", running ? "running" : "", live ? "dragging" : "", of > 1 ? "narrow" : "",
          ].join(" ");
          return (
            <div key={t.id} style={style} className={cls}
              onPointerDown={(e) => down(e, t)} onPointerMove={(e) => move(e, t)} onPointerUp={() => up(t)} onPointerCancel={() => setDrag(null)}>
              <span className="bpill" aria-hidden="true">{emoji}</span>
              <button className="bbody" tabIndex={reorg ? -1 : 0} onClick={() => !reorg && open({ type: "log", task: t })}
                aria-label={reorg ? undefined : `${t.title}, ${meta}`}>
                {tall && <span className="bmeta">{meta}{t.routineId && " · ↻"}</span>}
                <span className="btitle">
                  {t.fixed && <Icon name="lock" size={12} stroke={2.4} />}
                  {t.priority === "high" && <span className="prio" title="High priority">!</span>}
                  {t.title}
                  {t.ex && !reorg && <span className="chip ex">example</span>}
                </span>
                {!tall && <span className="bmeta">{meta}{size === "mid" && t.routineId && " · ↻"}</span>}
                {tall && h >= 74 && note}
              </button>
              {!reorg && (
                <button className={`bcheck ${done ? "on" : ""} ${t.status === "missed" ? "miss" : ""}`} onClick={() => toggle(t)}
                  aria-label={done ? `Mark ${t.title} not done` : t.ongoing ? `Finish ${t.title} now` : `Mark ${t.title} done`}>
                  {done && <Icon name="check" size={tall ? 16 : 14} stroke={3} />}
                </button>
              )}
              {reorg && <span className="handle" data-handle="1" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </div>
  );
});
