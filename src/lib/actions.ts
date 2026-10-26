import type { State, Task } from "../types";
import { rulesFor } from "./plan";

/** Count a logged block toward every rule that targets it (only once the rule existed). */
export function scoreRules(s: State, t: Task, ok: boolean) {
  for (const r of rulesFor(s, t.title)) {
    if (t.date < r.created) continue;
    if (ok) r.wins++;
    else r.fails++;
  }
}
