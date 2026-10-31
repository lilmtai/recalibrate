import type { State, Task } from "../types";
import { rulesFor } from "./plan";
import { addDays } from "./time";

/** Count a logged block toward every rule that targets it (only once the rule existed). */
export function scoreRules(s: State, t: Task, ok: boolean) {
  for (const r of rulesFor(s, t.title)) {
    if (t.date < r.created) continue;
    if (ok) r.wins++;
    else r.fails++;
  }
}

/** Free block done: comes back after its interval, or disappears if it was a one-off. Mutates the draft. */
export function freeDone(s: State, id: string, on: string) {
  const f = s.free.find((x) => x.id === id);
  if (!f) return;
  if (!f.everyDays) { s.free = s.free.filter((x) => x.id !== id); return; }
  f.lastDone = on;
  f.nextDue = addDays(on, f.everyDays);
}

/** Free block snoozed to tomorrow. */
export function freeLater(s: State, id: string, from: string) {
  const f = s.free.find((x) => x.id === id);
  if (f) f.nextDue = addDays(from, 1);
}

/** Record the real start of a block (first time only). Mutates the draft task. */
export function markStarted(t: Task, at: Date = new Date()) {
  if (!t.startedAt) t.startedAt = at.toISOString();
}

/** Record the real end of a block. */
export function markEnded(t: Task, at: Date = new Date()) {
  t.endedAt = at.toISOString();
}

/** "never started" vs "started, unfinished" vs finished, for analytics. */
export function startState(t: Task): "finished" | "started" | "not_started" | "open" {
  if (t.status === "done" || t.status === "ifnot") return "finished";
  if (t.status === "partial" || ((t.status === "missed") && t.startedAt)) return "started";
  if (t.status === "missed") return "not_started";
  return t.startedAt ? "started" : "open";
}
