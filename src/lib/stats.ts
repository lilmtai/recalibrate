import type { BarrierKey, CategoryKey, InsteadKey, State, Task } from "../types";
import { addDays, today } from "./time";

export const isWin = (t: Task) => t.status === "done" || t.status === "ifnot";
/** 1 for done or "if not", the done share for partial, 0 for missed */
export const score = (t: Task) => (isWin(t) ? 1 : t.status === "partial" ? t.share ?? 0.5 : 0);
const LOGGED = ["done", "ifnot", "missed", "partial"];

export function multiplier(s: State): number | null {
  const xs = s.tasks.filter((t) => t.actual && t.dur).map((t) => t.actual! / t.dur);
  return xs.length < 3 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

const rate = (arr: Task[]) => (arr.length ? Math.round((arr.reduce((a, t) => a + score(t), 0) / arr.length) * 100) : null);

export function stats14(s: State) {
  const from = addDays(today(), -13);
  const ts = s.tasks.filter((t) => t.date >= from && t.date <= today() && LOGGED.includes(t.status));
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

  // where the time went when blocks didn't (fully) happen, in minutes
  const instead: Partial<Record<InsteadKey, number>> = {};
  const addInstead = (keys: InsteadKey[], min: number) =>
    keys.forEach((k) => (instead[k] = (instead[k] || 0) + Math.round(min / keys.length)));
  ts.forEach((t) => {
    if (!t.instead?.what.length) return;
    const lost = t.status === "partial" ? t.dur * (1 - (t.share ?? 0.5)) : t.status === "missed" ? t.dur : 0;
    if (lost) addInstead(t.instead.what, lost);
  });
  const checks = s.tasks.filter((t) => t.date >= from).flatMap((t) => t.checks || []);

  // planned vs. actual per block name
  const est: Record<string, { n: number; planned: number; actual: number }> = {};
  s.tasks.filter((t) => t.actual && t.date >= from).forEach((t) => {
    const e = (est[t.title] ||= { n: 0, planned: 0, actual: 0 });
    e.n++; e.planned += t.dur; e.actual += t.actual!;
  });
  const estimates = Object.entries(est)
    .map(([title, e]) => ({ title, n: e.n, planned: Math.round(e.planned / e.n), actual: Math.round(e.actual / e.n), ratio: e.actual / e.planned }))
    .sort((a, b) => b.ratio - a.ratio);
  return {
    ts,
    rate: rate(ts),
    ifNots: ts.filter((t) => t.status === "ifnot").length,
    partials: ts.filter((t) => t.status === "partial").length,
    instead,
    estimates,
    checks: checks.length,
    drift: checks.length ? Math.round((checks.filter((c) => !c.on).length / checks.length) * 100) : null,
    barriers,
    byEnergy,
    byCategory,
    byTask,
    shortSleep: rate(ts.filter((t) => (sleepOf(t) ?? 99) < 6)),
    goodSleep: rate(ts.filter((t) => (sleepOf(t) ?? 0) >= 6)),
  };
}
