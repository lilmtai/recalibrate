import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "../ctx";
import { CAT_LABEL } from "../constants";
import { toMin, today, uid } from "../lib/time";
import { tasksFor } from "../lib/plan";
import { cancelFocus, elapsedMin, endFocus, extendFocus, keepGoing, pauseFocus, remainingMs, resumeFocus } from "../lib/focus";
import { Icon } from "./Icon";

const clock = (ms: number) => {
  const t = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
};

/** Ticks every second while focus is on screen. */
function useNowTick() {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setN(new Date()), 1000); return () => clearInterval(t); }, []);
  return n;
}

/**
 * Focus mode: only the current block, time left, what's next, a capture box,
 * and Pause / +10 / Done / Stop. When time runs out it asks, in one tap, what's next.
 */
export function FocusView({ onMinimize }: { onMinimize: () => void }) {
  const { state, update, celebrate, toast, open } = useApp();
  const f = state.focus!;
  const now = useNowTick();
  const task = state.tasks.find((t) => t.id === f.taskId) || tasksFor(state, f.date).find((t) => t.id === f.taskId);
  const left = remainingMs(f, now);
  const total = new Date(f.endsAt).getTime() - new Date(f.startedAt).getTime() - f.pausedMs;
  const progress = Math.min(1, Math.max(0, 1 - left / Math.max(1, total)));
  const over = left <= 0;
  const next = tasksFor(state, f.date).find((t) => t.status === "open" && t.id !== f.taskId && toMin(t.start) >= toMin(task?.start || "00:00"));
  const [note, setNote] = useState("");
  const buzzed = useRef(false);

  // a gentle nudge when time is up (once)
  useEffect(() => {
    if (over && !buzzed.current) { buzzed.current = true; try { navigator.vibrate?.([30, 60, 30]); } catch { /* not supported */ } }
    if (!over) buzzed.current = false;
  }, [over]);

  const done = () => { update((s) => endFocus(s, new Date(), "done")); celebrate(); toast(`Done · ${elapsedMin(f, new Date())} min`); };
  const partly = () => { update((s) => endFocus(s, new Date(), "partial")); toast("Logged as partly done. Starting counts."); };
  const capture = () => {
    const t = note.trim();
    if (!t) return;
    update((s) => { s.notes.push({ id: uid(), date: today(), text: t, done: false }); });
    setNote("");
    toast("Saved to your to-dos. Back to it.");
  };

  if (!task) {
    return (
      <div className="focus-screen"><div className="focus-inner">
        <p>This block isn't here anymore.</p>
        <button className="btn" onClick={() => update((s) => cancelFocus(s, new Date()))}>Close focus</button>
      </div></div>
    );
  }

  const R = 112, C = 2 * Math.PI * R;
  return (
    <div className="focus-screen" role="dialog" aria-modal="true" aria-label={`Focus: ${task.title}`} style={{ "--c": `var(--c-${task.category})` } as CSSProperties}>
      <div className="focus-inner">
        <div className="focus-top">
          <span className="chip"><span className="swatch" />{CAT_LABEL[task.category]}</span>
          <button className="roundbtn" aria-label="Minimize focus" onClick={onMinimize}><Icon name="back" size={18} /></button>
        </div>

        <h1 className="focus-title">{task.title}</h1>
        {f.mode === "five" && !over && <div className="focus-sub">Just 5 minutes. That's all you promised.</div>}
        {task.ifNot && f.mode === "block" && !over && <div className="focus-sub">Too much? The “if not” version counts: {task.ifNot}</div>}

        <div className="focus-ring" aria-live="polite">
          <svg viewBox="0 0 260 260" width="260" height="260" aria-hidden="true">
            <circle cx="130" cy="130" r={R} className="ring-bg" />
            <circle cx="130" cy="130" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 130 130)" />
          </svg>
          <div className="ring-text">
            <b>{over ? `+${clock(left)}` : clock(left)}</b>
            <span>{f.pausedAt ? "paused" : over ? "over time" : "left"}</span>
          </div>
        </div>

        {over ? (
          f.mode === "five" ? (
            <div className="focus-ask">
              <div className="focus-q">5 minutes done. Keep going?</div>
              <div className="focus-btns">
                <button className="btn big primary" onClick={() => update((s) => keepGoing(s, new Date()))}>Keep going</button>
                <button className="btn big" onClick={partly}>That's enough for now</button>
              </div>
            </div>
          ) : (
            <div className="focus-ask">
              <div className="focus-q">Time's up. Need more time?</div>
              <div className="focus-btns">
                <button className="btn big" onClick={() => update((s) => extendFocus(s, 10, new Date()))}>+10 min</button>
                <button className="btn big" onClick={() => update((s) => extendFocus(s, 30, new Date()))}>+30 min</button>
                <button className="btn big primary" onClick={done}>Done</button>
              </div>
            </div>
          )
        ) : (
          <div className="focus-btns">
            {f.pausedAt
              ? <button className="btn big" onClick={() => update((s) => resumeFocus(s, new Date()))}>Resume</button>
              : <button className="btn big" onClick={() => update((s) => pauseFocus(s, new Date()))}>Pause</button>}
            <button className="btn big" onClick={() => update((s) => extendFocus(s, 10, new Date()))}>+10 min</button>
            <button className="btn big primary" onClick={done}>Done</button>
          </div>
        )}

        <div className="focus-capture">
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="A thought popped up? Park it here" aria-label="Capture a thought" />
          <button className="btn" disabled={!note.trim()} onClick={capture}>Save</button>
        </div>

        <div className="focus-foot">
          {next ? <span>Next: <b>{next.title}</b> at {next.start}</span> : <span>Nothing else planned after this.</span>}
          <span className="spacer" />
          <button className="btn ghost small" onClick={() => { const t = task; update((s) => cancelFocus(s, new Date())); open({ type: "log", task: t }); }}>Stop</button>
        </div>
      </div>
    </div>
  );
}

/** Slim bar above the tab bar while focus is minimized. */
export function FocusBar({ onOpen }: { onOpen: () => void }) {
  const { state } = useApp();
  const f = state.focus!;
  const now = useNowTick();
  const task = state.tasks.find((t) => t.id === f.taskId);
  const left = remainingMs(f, now);
  return (
    <button className={`focusbar ${left <= 0 ? "over" : ""}`} onClick={onOpen} style={{ "--c": `var(--c-${task?.category || "work"})` } as CSSProperties}>
      <span className="swatch" />
      <span className="grow">{task?.title || "Focus"}</span>
      <b>{left <= 0 ? "Time's up" : f.pausedAt ? "Paused" : clock(left)}</b>
    </button>
  );
}
