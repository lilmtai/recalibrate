import type { CategoryKey, Energy, State, Status, Task } from "./types";
import { addDays, today, uid, weekday } from "./lib/time";
import { syncActuals } from "./lib/actuals";

/** Fills the planner with a realistic past week, routines and rules. Everything is flagged `ex` so it can be cleared. */
export function loadExample(s: State) {
  const T = today();
  const mk = (d: number, title: string, start: string, dur: number, category: CategoryKey, energy: Energy | undefined, ifNot: string, status: Status, extra: Partial<Task> = {}): Task =>
    ({ id: uid(), date: addDays(T, d), title, start, dur, category, energy, ifNot, status, ex: true, ...extra });

  const days: [number, "low" | "steady" | "high", number][] = [[-6, "steady", 7], [-5, "low", 5.5], [-4, "steady", 7.5], [-3, "high", 8], [-2, "low", 5], [-1, "steady", 6.5]];
  days.forEach(([d, energy, sleep]) => (s.checkins[addDays(T, d)] = { energy, sleep, ex: true }));

  const gymId = uid();
  const deep = uid();
  const gymOut: Record<number, [Status, string?]> = { [-6]: ["done"], [-5]: ["missed", "energy"], [-4]: ["done"], [-3]: ["done"], [-2]: ["missed", "bloated"], [-1]: ["ifnot"] };
  const deepOut: Record<number, [Status, number | string]> = { [-6]: ["done", 130], [-5]: ["missed", "overwhelm"], [-4]: ["done", 120], [-3]: ["done", 100], [-2]: ["missed", "sleep"], [-1]: ["done", 110] };

  // routines start a week ago so past instances are logged tasks, today's are live
  s.routines.push(
    { id: deep, title: "Deep work: Q4 strategy", start: "09:00", dur: 90, category: "work", energy: "high", ifNot: "25 min outline only", days: [0, 1, 2, 3, 4], since: addDays(T, -6), ex: true },
    { id: gymId, title: "Gym", start: "18:00", dur: 60, category: "health", energy: "high", ifNot: "20-minute walk", days: [0, 1, 2, 3, 4, 5], since: addDays(T, -6), ex: true },
    { id: uid(), title: "Plan tomorrow", start: "21:30", dur: 15, category: "me", energy: "low", ifNot: "Pick the top 1", days: [0, 1, 2, 3, 4, 5, 6], since: T, ex: true },
  );

  days.forEach(([d]) => {
    const wd = weekday(addDays(T, d));
    const dp = deepOut[d], g = gymOut[d];
    if (wd < 5) s.tasks.push(mk(d, "Deep work: Q4 strategy", "09:00", 90, "work", "high", "25 min outline only", dp[0], { routineId: deep, ...(dp[0] === "done" ? { actual: dp[1] as number, checks: [{ at: 585, on: d !== -4 }] } : { barrier: dp[1] as never, instead: { what: dp[1] === "overwhelm" ? ["otherwork", "phone"] : ["urgent"] } }) }));
    if (wd < 6) s.tasks.push(mk(d, "Gym", "18:00", 60, "health", "high", "20-minute walk", g[0], { routineId: gymId, ...(g[1] ? { barrier: g[1] as never, instead: { what: g[1] === "energy" ? ["rest", "phone"] : ["food", "phone"] } } : {}) }));
    s.tasks.push(mk(d, "Inbox + admin", "14:00", 45, "work", "med", "Reply to the 3 most urgent",
      d === -3 ? "missed" : d === -5 ? "partial" : "done",
      d === -3 ? { barrier: "time", instead: { what: ["hyperfocus"], note: "kept polishing the deck" } }
        : d === -5 ? { share: 0.5, instead: { what: ["people"] } } : { actual: 60 }));
    if (d === -4 || d === -1) s.tasks.push(mk(d, "Dinner with Sam", "19:30", 90, "social", undefined, "Call instead", d === -4 ? "missed" : "done", d === -4 ? { barrier: "energy" } : {}));
    if (d === -5 || d === -3) s.tasks.push(mk(d, "Newsletter draft", "20:00", 60, "side", "med", "Write the headline", d === -5 ? "missed" : "done", d === -5 ? { barrier: "avoid" } : { actual: 75 }));
  });

  s.rules.push(
    { id: uid(), ex: true, match: "gym", barrier: "energy", fix: "Small snack with protein", remind: { kind: "before", lead: 60 }, created: addDays(T, -4), wins: 2, fails: 1 },
    { id: uid(), ex: true, match: "gym", barrier: "bloated", fix: "Keep lunch light on gym days", remind: { kind: "before", lead: 240 }, created: addDays(T, -1), wins: 0, fails: 0 },
    { id: uid(), ex: true, match: "deep work", barrier: "overwhelm", fix: "Write the first 2-minute step", remind: { kind: "at", time: "21:00", dayBefore: true }, created: addDays(T, -4), wins: 2, fails: 1 },
    { id: uid(), ex: true, match: "gym", barrier: "forgot", fix: "Set an alarm for tomorrow", remind: { kind: "at", time: "21:00", dayBefore: true }, created: T, wins: 0, fails: 0 },
  );

  s.notes.push(
    { id: uid(), date: addDays(T, -1), text: "Book dentist", done: false, ex: true },
    { id: uid(), date: T, text: "Reply to Jonas about the offer", done: false, ex: true },
    { id: uid(), date: T, text: "Buy protein bars", done: false, ex: true },
    { id: uid(), date: T, text: "Renew gym membership", done: true, doneDate: T, ex: true },
  );

  s.tasks.push(
    mk(0, "Morning pages", "07:30", 20, "me", "low", "5 lines", "open"),
    mk(0, "Lunch away from desk", "12:30", 45, "me", undefined, "", "open"),
    mk(0, "Inbox + admin", "14:00", 45, "work", "med", "Reply to the 3 most urgent", "open"),
    mk(0, "Client calls", "15:00", 60, "side", "med", "Send a voice note", "open"),
    mk(1, "Coffee with Maya", "17:00", 45, "social", "low", "Text to reschedule", "open"),
  );

  // "My day": fill in what really happened from the logged blocks, plus a few unplanned things
  for (const t of s.tasks.filter((x) => x.ex && x.status !== "open")) syncActuals(s, t);
  const free = (d: number, start: number, end: number, title: string, category?: CategoryKey) =>
    s.actuals.push({ id: uid(), date: addDays(T, d), start, end, title, kind: "free", category, ex: true });
  free(-1, 7 * 60 + 40, 8 * 60 + 25, "Phone in bed");
  free(-1, 12 * 60 + 30, 13 * 60 + 20, "Lunch with team", "social");
  free(-1, 16 * 60, 17 * 60 + 10, "Fixed a client bug (unplanned)", "side");
  free(-1, 20 * 60 + 30, 22 * 60, "Series on Netflix", "me");
  free(0, 7 * 60 + 15, 7 * 60 + 50, "Phone in bed");
}
