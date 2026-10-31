import { blank } from "../store";
import type { Routine, State, Task } from "../types";

/** A fixed "now" for tests: Wednesday 2026-11-04 10:00 local time. */
export const NOW = new Date(2026, 10, 4, 10, 0, 0);
export const TODAY = "2026-11-04"; // a Wednesday (weekday index 2)

export function state(patch: Partial<State> = {}): State {
  return { ...blank(), dayHours: { start: "07:00", end: "23:00" }, ...patch };
}

export function task(p: Partial<Task> = {}): Task {
  return { id: p.id || Math.random().toString(36).slice(2), date: TODAY, title: "Deep work", start: "09:00", dur: 90, category: "work", status: "open", ...p };
}

export function routine(p: Partial<Routine> = {}): Routine {
  return { id: p.id || "r1", title: "Gym", start: "18:00", dur: 60, category: "health", days: [0, 2, 4], since: "2026-11-01", ...p };
}
