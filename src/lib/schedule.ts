/**
 * The scheduling engine: deterministic, no AI, no side effects (docs/SCHEDULING_RULES.md).
 * `proposeRecovery` turns a slipping day into a proposal (a list of changes with reasons);
 * `applyRecovery` applies the changes the user approved. Nothing changes without approval.
 */
import type { Priority, State, Task } from "../types";
import { materialize } from "./plan";
import { moveTask } from "./actions";
import { addDays, fmt, toMin } from "./time";

export type RecoveryMode = "fix" | "minimum";

export type ChangeKind =
  | "move" // new time today
  | "shorten" // minimum version, maybe at a new time
  | "postpone" // to a later day (approval required)
  | "tray" // off today's timeline, into the tray (optional)
  | "skip" // routine instance skipped for today
  | "nofit"; // has to happen today but no room: needs the user's call, nothing changes

export interface Change {
  id: string;
  title: string;
  kind: ChangeKind;
  from: { start: string; dur: number };
  to?: { start: string; dur: number; date?: string };
  reason: string;
}

export interface Proposal {
  date: string;
  mode: RecoveryMode;
  changes: Change[];
  /** fixed appointments that keep their time */
  fixedKept: number;
  /** flexible blocks that stay where they are */
  unchanged: number;
}

export interface RecoveryInput {
  date: string;
  /** the day's blocks (`tasksFor`): real tasks and routine instances */
  tasks: Task[];
  /** minutes after midnight now; use -1 for a day that hasn't started */
  now: number;
  dayHours: { start: string; end: string };
  mode?: RecoveryMode;
  /** a low-energy check-in: shorter versions first, low-priority hard work moves */
  lowEnergy?: boolean;
  /** id of the block running in focus mode */
  runningId?: string;
  /** following days' blocks, for "postpone to …" (nearest day first) */
  later?: { date: string; tasks: Task[] }[];
}

const PRIO: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
const prio = (t: Task) => PRIO[t.priority || "normal"];
/** protected slack after a long, demanding block (SCHEDULING_RULES → buffer) */
export const BUFFER_AFTER = 10;
const needsBuffer = (t: Task, dur: number) => dur >= 60 && (t.energy === "high" || t.difficulty === "hard");
const isOpen = (t: Task) => t.status === "open";
const end = (t: Task) => toMin(t.start) + t.dur;

type Busy = { s: number; e: number };
const overlaps = (b: Busy[], s: number, e: number) => b.some((x) => s < x.e && e > x.s);

/** Earliest start ≥ `from` where `dur` minutes fit inside [from, until] without touching `busy`. */
export function earliestFit(busy: Busy[], from: number, until: number, dur: number): number | null {
  const sorted = [...busy].sort((a, b) => a.s - b.s);
  let t = from;
  for (const b of sorted) {
    if (b.e <= t) continue;
    if (b.s >= t + dur) break;
    t = Math.max(t, b.e);
  }
  return t + dur <= until ? t : null;
}

/** Order for the engine: priority, nearer deadline, then planned order (SCHEDULING_RULES → soft 1). */
export function byImportance(a: Task, b: Task): number {
  return prio(a) - prio(b)
    || (a.deadline || "9999").localeCompare(b.deadline || "9999")
    || toMin(a.start) - toMin(b.start)
    || a.id.localeCompare(b.id);
}

/** The one task a minimum day keeps besides fixed and essential blocks. */
export function topTask(tasks: Task[]): Task | undefined {
  return tasks.filter((t) => isOpen(t) && !t.fixed && !t.essential).sort(byImportance)[0];
}

/** A block that's running right now: in focus, ongoing, or started and not finished. Never moved. */
function isRunning(t: Task, now: number, runningId?: string) {
  if (t.id === runningId) return true;
  if (!isOpen(t)) return false;
  if (t.ongoing && toMin(t.start) <= now) return true;
  return !!t.startedAt && !t.endedAt && toMin(t.start) <= now;
}

/** Next free slot on a later day for a postponed block, within the day hours. */
function laterSlot(input: RecoveryInput, t: Task, dur: number): { date: string; start: number } | null {
  const ws = toMin(input.dayHours.start);
  const we = toMin(input.dayHours.end);
  for (const day of input.later || []) {
    if (t.deadline && day.date > t.deadline) return null;
    const busy = day.tasks.filter((x) => x.status !== "skipped").map((x) => ({ s: toMin(x.start), e: end(x) }));
    // keep the planned time if it's free that day, else the first gap
    const own = toMin(t.start);
    if (own >= ws && own + dur <= we && !overlaps(busy, own, own + dur)) return { date: day.date, start: own };
    const s = earliestFit(busy, ws, we, dur);
    if (s !== null) return { date: day.date, start: s };
  }
  return null;
}

/**
 * Propose a calmer rest of the day (SCHEDULING_RULES → Recovery):
 * 1. Freeze fixed, finished and running blocks. 2. Sort the rest by priority, deadline, planned order.
 * 3. Give each the earliest free slot from max(now, its planned start), so nothing is pulled earlier
 *    than planned and blocks that still fit stay put. 4. If it doesn't fit: minimum version, then
 *    another day, then the tray (routines: skip today). Blocks that must happen today are flagged.
 */
export function proposeRecovery(input: RecoveryInput): Proposal {
  const { date, tasks, now, runningId } = input;
  const mode = input.mode || "fix";
  const ws = toMin(input.dayHours.start);
  const we = Math.max(ws, toMin(input.dayHours.end));
  const from = Math.max(ws, now < 0 ? ws : Math.ceil(now / 5) * 5);

  const busy: Busy[] = [];
  const reserve = (t: Task, s: number, dur: number) => {
    busy.push({ s, e: s + dur + (needsBuffer(t, dur) ? BUFFER_AFTER : 0) });
  };

  let fixedKept = 0;
  const flexible: Task[] = [];
  for (const t of tasks) {
    if (t.status === "skipped" || t.unplaced) continue;
    if (t.fixed) {
      if (isOpen(t)) fixedKept++;
      reserve(t, toMin(t.start), t.dur);
    } else if (!isOpen(t)) {
      // logged blocks are history: they keep their place
      reserve(t, toMin(t.start), t.dur);
    } else if (isRunning(t, now, runningId)) {
      // the running block keeps going; if it overran, it holds the time until now
      const s = toMin(t.start);
      reserve(t, s, Math.max(t.dur, now - s));
    } else {
      flexible.push(t);
    }
  }

  const changes: Change[] = [];
  let unchanged = 0;
  const top = mode === "minimum" ? topTask(flexible) : undefined;
  const fromOf = (t: Task) => ({ start: t.start, dur: t.dur });

  // the part of a block that doesn't fit today
  const offToday = (t: Task, why: string) => {
    if (t.routineId) {
      changes.push({ id: t.id, title: t.title, kind: "skip", from: fromOf(t), reason: `${why} Skipped for today; the routine stays.` });
      return;
    }
    if (t.noPostpone) {
      changes.push({ id: t.id, title: t.title, kind: "nofit", from: fromOf(t), reason: `${why} It has to happen today: shorten or move something by hand.` });
      return;
    }
    const slot = laterSlot(input, t, t.dur);
    if (slot) {
      const day = slot.date === addDays(date, 1) ? "tomorrow" : "a later day";
      changes.push({ id: t.id, title: t.title, kind: "postpone", from: fromOf(t), to: { start: fmt(slot.start), dur: t.dur, date: slot.date }, reason: `${why} Next free slot is ${day}.` });
      return;
    }
    changes.push({ id: t.id, title: t.title, kind: "tray", from: fromOf(t), reason: `${why} Parked in the tray: drag it back if a gap opens.` });
  };

  // missed blocks (time fully passed) fill later gaps instead of pushing the current plan around
  const passed = (t: Task) => (end(t) <= from ? 1 : 0);
  const order = [...flexible].sort((a, b) => prio(a) - prio(b) || passed(a) - passed(b) || byImportance(a, b));
  for (const t of order) {
    const planned = toMin(t.start);

    if (mode === "minimum" && t.id !== top?.id && !t.essential && !t.noPostpone) {
      if (t.routineId) changes.push({ id: t.id, title: t.title, kind: "skip", from: fromOf(t), reason: "Minimum day: optional today. The routine stays." });
      else changes.push({ id: t.id, title: t.title, kind: "tray", from: fromOf(t), reason: "Minimum day: optional today. It waits in the tray." });
      continue;
    }

    // low energy: hard or high-energy work shrinks to its minimum, or moves if it's low priority
    const drained = !!input.lowEnergy && (t.energy === "high" || t.difficulty === "hard");
    if (drained && t.priority === "low" && !t.noPostpone) {
      offToday(t, "Low energy today and it's low priority.");
      continue;
    }
    const wantDur = drained && t.minDur ? t.minDur : t.dur;

    const after = Math.max(from, planned);
    // a block you placed after your day hours may stay there (hard rule 3)
    const until = Math.max(we, planned + t.dur);
    const s = earliestFit(busy, after, until, wantDur);
    if (s !== null) {
      reserve(t, s, wantDur);
      if (s === planned && wantDur === t.dur) { unchanged++; continue; }
      const kind: ChangeKind = wantDur < t.dur ? "shorten" : "move";
      const reason = kind === "shorten"
        ? `Low energy today: the ${wantDur}-minute version.`
        : planned < from ? (t.startedAt ? "Overran: continues after the running block." : "Its time has passed; this is the next free slot.")
        : "Makes room: something earlier ran over or took its place.";
      changes.push({ id: t.id, title: t.title, kind, from: fromOf(t), to: { start: fmt(s), dur: wantDur }, reason });
      continue;
    }
    // full length doesn't fit: try the minimum version (soft rule: prefer it over dropping)
    if (t.minDur && t.minDur < wantDur) {
      const m = earliestFit(busy, after, until, t.minDur);
      if (m !== null) {
        reserve(t, m, t.minDur);
        changes.push({ id: t.id, title: t.title, kind: "shorten", from: fromOf(t), to: { start: fmt(m), dur: t.minDur }, reason: `Only the ${t.minDur}-minute version fits today.` });
        continue;
      }
    }
    offToday(t, "Doesn't fit in what's left of today.");
  }

  // show changes in the order of the day
  changes.sort((a, b) => toMin(a.to?.date ? "99:99" : a.to?.start || a.from.start) - toMin(b.to?.date ? "99:99" : b.to?.start || b.from.start) || toMin(a.from.start) - toMin(b.from.start));
  return { date, mode, changes, fixedKept, unchanged };
}

/**
 * Apply the approved changes to the state draft. Every time change is recorded in the block's
 * history with source "recovery". Returns how many changes were applied.
 */
export function applyRecovery(s: State, date: string, tasks: Task[], changes: Change[], at: Date = new Date()): number {
  let n = 0;
  for (const c of changes) {
    const t = tasks.find((x) => x.id === c.id);
    if (!t || c.kind === "nofit") continue;
    const real = materialize(s, t);
    if (real.date !== date || real.status !== "open") continue;
    if (c.kind === "move" || c.kind === "shorten") {
      moveTask(real, c.to!.start, c.to!.dur, "recovery", at);
    } else if (c.kind === "postpone") {
      (real.moves ||= []).push({ at: at.toISOString(), from: real.start, to: c.to!.start, toDate: c.to!.date, source: "recovery" });
      real.date = c.to!.date!;
      real.start = c.to!.start;
    } else if (c.kind === "tray") {
      (real.moves ||= []).push({ at: at.toISOString(), from: real.start, to: "", source: "recovery" });
      real.unplaced = true;
    } else if (c.kind === "skip") {
      real.status = "skipped";
    }
    n++;
  }
  return n;
}

/**
 * When to offer "Fix my day" by itself (R-4). Only an offer: nothing changes without approval.
 * Returns a short reason, or null.
 */
export function recoveryTrigger(tasks: Task[], now: number, opts: { lowEnergy?: boolean; runningId?: string } = {}): string | null {
  const open = tasks.filter(isOpen);
  const running = open.find((t) => isRunning(t, now, opts.runningId) && !t.ongoing);
  if (running && now - end(running) >= 30) return `“${running.title}” ran over by ${now - end(running)} minutes.`;
  const unlogged = open.filter((t) => !t.ongoing && end(t) <= now && !isRunning(t, now, opts.runningId));
  if (unlogged.length >= 2) return `${unlogged.length} blocks slipped by.`;
  if (opts.lowEnergy && open.some((t) => toMin(t.start) >= now && (t.energy === "high" || t.difficulty === "hard"))) return "Low energy today.";
  return null;
}
