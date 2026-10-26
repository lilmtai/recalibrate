import type { Cue, Remind, Rule, State, Task } from "../types";
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
    .filter((t) => t.status !== "skipped")
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

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
    out.push({ key: `${t.id}:start`, at: toMin(t.start) - 5, text: `${t.title} starts at ${t.start}`, forTask: t.title, tomorrow: false, kind: "transition" });
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
