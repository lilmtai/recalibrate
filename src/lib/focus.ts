import type { State, Task } from "../types";
import { materialize, tasksFor } from "./plan";
import { markEnded, markStarted, scoreRules } from "./actions";
import { syncActuals } from "./actuals";
import { toMin, uid } from "./time";

/**
 * Start / focus mode. Pure functions on the state draft, so they're easy to test.
 * A focus session records the real start, keeps a running "My day" entry, and
 * ends as done (with the real length) or partly done (no guilt).
 */

const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const iso = (d: Date) => d.toISOString();

/** When the block should end if started now: its planned end if we're inside it, else now + its length. */
export function plannedEnd(t: Task, now: Date): Date {
  const end = new Date(now);
  const plannedEndMin = toMin(t.start) + t.dur;
  if (minuteOf(now) >= toMin(t.start) && minuteOf(now) < plannedEndMin) end.setHours(0, plannedEndMin, 0, 0);
  else end.setTime(now.getTime() + t.dur * 60_000);
  return end;
}

/** Start focusing on a block; `five` starts with just 5 minutes. Stops any other running "now doing" entry. */
export function startFocus(s: State, task: Task, now: Date, five = false) {
  const t = materialize(s, task);
  markStarted(t, now);
  const m = minuteOf(now);
  for (const a of s.actuals) if (a.end === undefined) a.end = Math.max(a.start + 1, m);
  const actualId = uid();
  s.actuals.push({ id: actualId, date: t.date, start: m, title: t.title, kind: "plan", category: t.category, taskId: t.id, auto: true });
  s.focus = {
    taskId: t.id, date: t.date, startedAt: iso(now), mode: five ? "five" : "block", pausedMs: 0, actualId,
    endsAt: iso(five ? new Date(now.getTime() + 5 * 60_000) : plannedEnd(t, now)),
  };
}

/** Milliseconds left (negative when over time). */
export function remainingMs(f: NonNullable<State["focus"]>, now: Date): number {
  const ref = f.pausedAt ? new Date(f.pausedAt) : now;
  return new Date(f.endsAt).getTime() - ref.getTime();
}

/** Minutes actually spent, excluding pauses. */
export function elapsedMin(f: NonNullable<State["focus"]>, now: Date): number {
  const ref = f.pausedAt ? new Date(f.pausedAt) : now;
  return Math.max(1, Math.round((ref.getTime() - new Date(f.startedAt).getTime() - f.pausedMs) / 60_000));
}

export function pauseFocus(s: State, now: Date) {
  if (s.focus && !s.focus.pausedAt) s.focus.pausedAt = iso(now);
}

export function resumeFocus(s: State, now: Date) {
  const f = s.focus;
  if (!f?.pausedAt) return;
  const paused = now.getTime() - new Date(f.pausedAt).getTime();
  f.pausedMs += paused;
  f.endsAt = iso(new Date(new Date(f.endsAt).getTime() + paused));
  f.pausedAt = undefined;
}

/** "+10 / +30": more time, counted on the block so estimates learn from it. */
export function extendFocus(s: State, minutes: number, now: Date) {
  const f = s.focus;
  if (!f) return;
  const base = Math.max(new Date(f.endsAt).getTime(), now.getTime());
  f.endsAt = iso(new Date(base + minutes * 60_000));
  const t = s.tasks.find((x) => x.id === f.taskId);
  if (t) t.extendedMin = (t.extendedMin || 0) + minutes;
}

/** After the 5 minutes: keep going through the rest of the block. */
export function keepGoing(s: State, now: Date) {
  const f = s.focus;
  if (!f) return;
  const t = s.tasks.find((x) => x.id === f.taskId);
  f.mode = "block";
  f.endsAt = iso(t ? plannedEnd(t, now) : new Date(now.getTime() + 25 * 60_000));
  if (new Date(f.endsAt).getTime() <= now.getTime()) f.endsAt = iso(new Date(now.getTime() + 25 * 60_000));
}

/** Finish: done with the real length, or "partly" (stopped early, no guilt). Clears the session. */
export function endFocus(s: State, now: Date, outcome: "done" | "partial") {
  const f = s.focus;
  if (!f) return;
  const t = s.tasks.find((x) => x.id === f.taskId) || tasksFor(s, f.date).find((x) => x.id === f.taskId);
  const spent = elapsedMin(f, now);
  const run = s.actuals.find((a) => a.id === f.actualId);
  if (run && run.end === undefined) run.end = Math.max(run.start + 1, run.start + spent);
  if (t) {
    const real = materialize(s, t);
    real.status = outcome === "done" ? "done" : "partial";
    if (outcome === "partial") real.share = Math.min(0.75, Math.max(0.25, Math.round((spent / real.dur) * 4) / 4));
    else real.actual = spent;
    markEnded(real, now);
    scoreRules(s, real, true);
    syncActuals(s, real); // replaces the running entry with the exact one
  }
  s.focus = undefined;
}

/** Leave focus without logging anything (the block stays open). */
export function cancelFocus(s: State, now: Date) {
  const f = s.focus;
  if (!f) return;
  const run = s.actuals.find((a) => a.id === f.actualId);
  if (run && run.end === undefined) run.end = Math.max(run.start + 1, minuteOf(now));
  s.focus = undefined;
}
