import type { Cue, Note, Remind, Rule, State, Task } from "../types";
import { addDays, fmt, norm, toMin, uid, weekday } from "./time";

const VIRTUAL = "rt:";
export const isVirtual = (id: string) => id.startsWith(VIRTUAL);

/** Real tasks for a day plus routine (sticky) blocks that haven't been logged yet. */
export function tasksFor(s: State, date: string): Task[] {
  const real = s.tasks.filter((t) => t.date === date);
  const virtual: Task[] = s.routines
    .filter((r) => r.days.includes(weekday(date)) && date >= r.since)
    .filter((r) => !real.some((t) => t.routineId === r.id))
    .map((r) => ({
      id: `${VIRTUAL}${r.id}:${date}`,
      date,
      title: r.title,
      start: r.start,
      dur: r.dur,
      category: r.category,
      energy: r.energy,
      ifNot: r.ifNot,
      status: "open",
      routineId: r.id,
      ex: r.ex,
    }));
  return [...real, ...virtual]
    .filter((t) => t.status !== "skipped" && !t.unplaced)
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

/** Blocks parked in the reorganize tray for a day. */
export const unplacedFor = (s: State, date: string) =>
  s.tasks.filter((t) => t.date === date && t.unplaced && t.status !== "skipped");

/** Post-its for a day. On today, unfinished ones from earlier days roll over. */
export function notesFor(s: State, date: string, isToday: boolean): Note[] {
  return s.notes
    .filter((n) => (isToday ? (n.date <= date && !n.done) || n.doneDate === date : n.date === date))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
}

/** A block that ended (or a past day's block) with nothing logged. */
export const needsLog = (t: Task, date: string, today: string, now: number) =>
  t.status === "open" && (date < today || (date === today && toMin(t.start) + t.dur <= now));

/** Turn a routine instance into a stored task so it can be logged or edited. Mutates the draft. */
export function materialize(s: State, t: Task): Task {
  if (!isVirtual(t.id)) return s.tasks.find((x) => x.id === t.id)!;
  const real: Task = { ...t, id: uid() };
  s.tasks.push(real);
  return real;
}

export const rulesFor = (s: State, title: string) =>
  s.rules.filter((r) => r.match && norm(title).includes(norm(r.match)));

export function remindLabel(r: Remind) {
  if (r.kind === "at") return `at ${r.time}${r.dayBefore ? " the night before" : " the same day"}`;
  return r.lead >= 60 ? `${r.lead / 60} h before` : `${r.lead} min before`;
}

/** Everything that should nudge you on `date`: fix reminders and 5-minute transition warnings. */
export function cuesFor(s: State, date: string): Cue[] {
  const out: Cue[] = [];
  const add = (t: Task, r: Rule, at: number, tomorrow: boolean) =>
    out.push({ key: `${t.id}:${r.id}`, at, text: r.fix, forTask: t.title, barrier: r.barrier, tomorrow, kind: "fix" });

  for (const t of tasksFor(s, date).filter((t) => t.status === "open")) {
    const st = toMin(t.start);
    out.push({ key: `${t.id}:start`, at: st - 5, text: `${t.title} starts at ${t.start}`, forTask: t.title, tomorrow: false, kind: "transition", taskId: t.id });
    if (t.dur >= 30 && !(t.checks || []).length)
      out.push({ key: `${t.id}:mid`, at: st + Math.round(t.dur / 2), text: `Halfway through ${t.title}. Still on it?`, forTask: t.title, tomorrow: false, kind: "mid", taskId: t.id });
    out.push({ key: `${t.id}:end`, at: st + t.dur, text: `${t.title} just ended. Log what happened.`, forTask: t.title, tomorrow: false, kind: "end", taskId: t.id });
    for (const r of rulesFor(s, t.title)) {
      if (r.remind.kind === "before") add(t, r, Math.max(0, toMin(t.start) - r.remind.lead), false);
      else if (!r.remind.dayBefore) add(t, r, toMin(r.remind.time), false);
    }
  }
  for (const t of tasksFor(s, addDays(date, 1)).filter((t) => t.status === "open")) {
    for (const r of rulesFor(s, t.title)) {
      if (r.remind.kind === "at" && r.remind.dayBefore) add(t, r, toMin(r.remind.time), true);
    }
  }
  // free blocks: remind on the due day, and each day after while it's still not done
  for (const f of s.free || []) {
    if (f.nextDue > date) continue;
    const every = f.everyDays ? `Every ${everyLabel(f.everyDays)}. Done, or tomorrow?` : "Done, or tomorrow?";
    out.push({ key: `free:${f.id}`, at: toMin(f.remindAt || "10:00"), text: every, forTask: f.title, tomorrow: false, kind: "free", freeId: f.id });
  }
  // "What are you doing?" on the hour while you're awake, skipped when a block prompt is already near
  const hrs = s.dayHours || { start: "07:00", end: "23:00" };
  const day = tasksFor(s, date);
  for (let at = (Math.floor(toMin(hrs.start) / 60) + 1) * 60; at <= toMin(hrs.end); at += 60) {
    if (out.some((c) => c.kind !== "fix" && c.kind !== "free" && Math.abs(c.at - at) <= 10)) continue;
    const planned = day.find((t) => toMin(t.start) <= at - 1 && at - 1 < toMin(t.start) + t.dur);
    out.push({
      key: `wyd:${at}`, at, kind: "wyd", tomorrow: false, forTask: planned?.title || "",
      text: planned ? `Planned: ${planned.title}. Still on it?` : "Tap to log the last hour.",
      taskId: planned?.id,
    });
  }
  // one cue per fix per day, even if two blocks match
  const seen = new Set<string>();
  return out
    .filter((c) => {
      const k = c.kind + c.text + c.at;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.at - b.at);
}

export const cueTime = (c: Cue) => fmt(c.at);

/** "2 weeks", "month", "3 days" */
export function everyLabel(days: number) {
  if (days === 7) return "week";
  if (days % 7 === 0 && days < 28) return `${days / 7} weeks`;
  if (days === 30) return "month";
  if (days % 30 === 0) return `${days / 30} months`;
  return `${days} days`;
}

/** Free blocks to show on a day: due that day, or (on today) anything overdue. */
export const freeDue = (s: State, date: string, isToday: boolean) =>
  (s.free || []).filter((f) => (isToday ? f.nextDue <= date : f.nextDue === date)).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
