import type { Actual, CategoryKey, InsteadKey, State, Task } from "../types";
import { INSTEAD_LABEL } from "../constants";
import { toMin, uid } from "./time";
import { tasksFor } from "./plan";

/** Rough area for time spent instead of a block, so the planned-vs-actual bars add up. */
const INSTEAD_CAT: Partial<Record<InsteadKey, CategoryKey>> = { otherwork: "work", urgent: "work", hyperfocus: "work", people: "social", rest: "me", food: "me" };

/**
 * Rewrite the automatic "My day" entries for a block from how it was logged.
 * Done → the block (for its real length); partial → the part done + what filled the rest;
 * missed → what filled the slot. Manual entries are never touched. Mutates the draft.
 */
export function syncActuals(s: State, t: Task) {
  s.actuals = s.actuals.filter((a) => !(a.auto && a.taskId === t.id));
  const st = toMin(t.start);
  const add = (start: number, end: number, extra: Partial<Actual>) => {
    if (end - start < 1) return;
    s.actuals.push({ id: uid(), date: t.date, start, end: Math.min(1440, end), title: t.title, kind: "plan", category: t.category, taskId: t.id, auto: true, ex: t.ex, ...extra });
  };
  const fillInstead = (from: number, to: number) => {
    const keys = t.instead?.what.length ? t.instead.what : t.checks?.find((c) => !c.on)?.what || [];
    if (!keys.length) return; // left as an unlogged gap
    const step = (to - from) / keys.length;
    keys.forEach((k, i) =>
      add(Math.round(from + i * step), Math.round(from + (i + 1) * step), {
        kind: "instead", insteadKey: k, category: INSTEAD_CAT[k],
        title: INSTEAD_LABEL[k] + (t.instead?.note && i === 0 ? ` (${t.instead.note})` : ""),
      }));
  };

  if (t.status === "done") add(st, st + (t.actual || t.dur), {});
  else if (t.status === "ifnot") add(st, st + t.dur, { title: t.ifNot ? `If not: ${t.ifNot}` : `${t.title} (short version)` });
  else if (t.status === "partial") {
    const mid = st + Math.round(t.dur * (t.share ?? 0.5));
    add(st, mid, {});
    fillInstead(mid, st + t.dur);
  } else if (t.status === "missed") fillInstead(st, st + t.dur);
}

export const actualsFor = (s: State, date: string) =>
  s.actuals.filter((a) => a.date === date).sort((a, b) => a.start - b.start);

const len = (a: Actual, now: number) => Math.max(0, (a.end ?? now) - a.start);

/** Planned vs. what really happened, for one day. */
export function daySummary(s: State, date: string, now: number) {
  const plan = tasksFor(s, date);
  const acts = actualsFor(s, date);
  const planned = plan.reduce((a, t) => a + t.dur, 0);
  // time spent on planned blocks, counted up to each block's planned length (overruns aren't extra credit)
  const usedPerTask: Record<string, number> = {};
  for (const a of acts.filter((a) => a.kind === "plan")) {
    const key = a.taskId || a.id;
    usedPerTask[key] = (usedPerTask[key] || 0) + len(a, now);
  }
  const onPlan = Object.entries(usedPerTask).reduce((x, [id, m]) => {
    const t = plan.find((p) => p.id === id);
    return x + (t ? Math.min(m, t.dur) : m);
  }, 0);
  const instead = acts.filter((a) => a.kind === "instead").reduce((x, a) => x + len(a, now), 0);
  const free = acts.filter((a) => a.kind === "free").reduce((x, a) => x + len(a, now), 0);
  const byCat = (k: CategoryKey) => ({
    planned: plan.filter((t) => t.category === k).reduce((a, t) => a + t.dur, 0),
    actual: acts.filter((a) => a.category === k).reduce((x, a) => x + len(a, now), 0),
  });
  // planned minutes (already past) with nothing logged against them
  const past = plan.filter((t) => t.status === "open" && toMin(t.start) + t.dur <= now).reduce((a, t) => a + t.dur, 0);
  return { planned, onPlan, instead, free, unlogged: past, byCat, count: acts.length };
}
