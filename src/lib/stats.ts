import type { BarrierKey, CategoryKey, State, Task } from "../types";
import { addDays, today } from "./time";

export const isWin = (t: Task) => t.status === "done" || t.status === "ifnot";

export function multiplier(s: State): number | null {
  const xs = s.tasks.filter((t) => t.actual && t.dur).map((t) => t.actual! / t.dur);
  return xs.length < 3 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

const rate = (arr: Task[]) => (arr.length ? Math.round((arr.filter(isWin).length / arr.length) * 100) : null);

export function stats14(s: State) {
  const from = addDays(today(), -13);
  const ts = s.tasks.filter((t) => t.date >= from && t.date <= today() && ["done", "ifnot", "missed"].includes(t.status));
  const barriers: Partial<Record<BarrierKey, number>> = {};
  ts.filter((t) => t.status === "missed" && t.barrier).forEach((t) => (barriers[t.barrier!] = (barriers[t.barrier!] || 0) + 1));
  const byEnergy = Object.fromEntries(
    (["low", "steady", "high"] as const).map((e) => [e, rate(ts.filter((t) => s.checkins[t.date]?.energy === e))]),
  ) as Record<"low" | "steady" | "high", number | null>;
  const byCategory = {} as Record<CategoryKey, number | null>;
  (["work", "health", "social", "side", "me"] as CategoryKey[]).forEach((c) => (byCategory[c] = rate(ts.filter((t) => t.category === c))));
  const byTask: Record<string, { n: number; miss: number; b: Partial<Record<BarrierKey, number>> }> = {};
  ts.forEach((t) => {
    const x = (byTask[t.title] ||= { n: 0, miss: 0, b: {} });
    x.n++;
    if (t.status === "missed") {
      x.miss++;
      if (t.barrier) x.b[t.barrier] = (x.b[t.barrier] || 0) + 1;
    }
  });
  const sleepOf = (t: Task) => s.checkins[t.date]?.sleep;
  return {
    ts,
    rate: rate(ts),
    ifNots: ts.filter((t) => t.status === "ifnot").length,
    barriers,
    byEnergy,
    byCategory,
    byTask,
    shortSleep: rate(ts.filter((t) => (sleepOf(t) ?? 99) < 6)),
    goodSleep: rate(ts.filter((t) => (sleepOf(t) ?? 0) >= 6)),
  };
}
