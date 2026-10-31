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
