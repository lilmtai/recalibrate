/**
 * The in-app assistant (pure, tested). The app computes the facts (free slots, capacity, stats) and sends a
 * compact picture of the person's schedule, work and history; Claude answers and may suggest blocks to add or
 * move. Every suggestion is checked here against the real schedule (hard rules from SCHEDULING_RULES.md) and is
 * only applied when the person taps it (docs/AI_BEHAVIOUR.md).
 */
import type { State, Task } from "../types";
import { BARRIER_LABEL, INSTEAD_LABEL, categoriesOf } from "../constants";
import { addDays, DAY_SHORT, fmt, toMin, uid, weekday } from "./time";
import { materialize, notesFor, tasksFor, freeDue } from "./plan";
import { capacity } from "./schedule";
import { freeGaps } from "./dayLayout";
import { moveTask } from "./actions";
import { multiplier, stats14 } from "./stats";
import { activeProjects, nextStep, pagesOf, stepsOf, JOURNAL } from "./work";
import { suggestEmoji } from "./emoji";

export const DAYS_AHEAD = 7;
const cut = (s: string | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : undefined);

/** Everything the assistant may know, kept small (no ids it doesn't need, long texts trimmed). */
export function buildAssistantContext(s: State, today: string, now: number) {
  const hrs = s.dayHours || { start: "07:00", end: "23:00" };
  const mx = multiplier(s);
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)).map((date) => {
    const tasks = tasksFor(s, date);
    const isToday = date === today;
    const from = Math.max(toMin(hrs.start), isToday ? Math.ceil(now / 15) * 15 : 0);
    const spans = tasks.map((t) => ({ id: t.id, start: toMin(t.start), dur: t.dur }));
    const cap = capacity({ tasks, now: isToday ? now : -1, dayHours: hrs, runningId: s.focus?.taskId, multiplier: mx });
    return {
      date,
      weekday: DAY_SHORT[weekday(date)],
      blocks: tasks.map((t) => ({
        id: t.id, title: t.title, start: t.start, end: fmt(toMin(t.start) + t.dur), category: t.category,
        status: t.status, ...(t.fixed ? { fixed: true } : {}), ...(t.priority && t.priority !== "normal" ? { priority: t.priority } : {}),
        ...(t.deadline ? { deadline: t.deadline } : {}), ...(t.energy ? { energy: t.energy } : {}),
        ...(t.routineId ? { routine: true } : {}), ...(t.minDur ? { minMinutes: t.minDur } : {}),
      })),
      // computed by the app: the only times new things can go without moving anything
      freeSlots: freeGaps(spans, from, toMin(hrs.end), 15).map((g) => ({ from: fmt(g.from), to: fmt(g.to), minutes: g.to - g.from })),
      capacity: { plannedMin: cap.planned, freeMin: Math.max(0, cap.free), overMin: cap.over },
      ...(s.checkins[date]?.energy ? { energy: s.checkins[date].energy } : {}),
    };
  });

  const st = stats14(s);
  const top = <K extends string>(rec: Partial<Record<K, number>>, label: Record<K, string>, n: number) =>
    (Object.entries(rec) as [K, number][]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${label[k]} (${v})`);
  // when blocks get done: share done by part of day, last 30 days
  const recent = s.tasks.filter((t) => t.date >= addDays(today, -30) && t.date < today && t.status !== "open" && t.status !== "skipped");
  const part = (m: number) => (m < 12 * 60 ? "morning" : m < 17 * 60 ? "afternoon" : "evening");
  const byPart: Record<string, { n: number; ok: number }> = {};
  for (const t of recent) {
    const p = (byPart[part(toMin(t.start))] ||= { n: 0, ok: 0 });
    p.n++;
    if (t.status === "done" || t.status === "ifnot") p.ok++;
  }
  const lastDays = Array.from({ length: 7 }, (_, i) => addDays(today, -1 - i)).map((date) => {
    const acts = s.actuals.filter((a) => a.date === date && a.end !== undefined);
    const byCat: Record<string, number> = {};
    for (const a of acts) byCat[a.title] = (byCat[a.title] || 0) + (a.end! - a.start);
    return { date, logged: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, m]) => `${t} ${m}m`) };
  }).filter((d) => d.logged.length);

  return {
    now: { date: today, weekday: DAY_SHORT[weekday(today)], time: fmt(now) },
    dayHours: hrs,
    categories: categoriesOf(s).map((c) => ({ key: c.key, label: c.label })),
    days,
    todos: notesFor(s, today, true).filter((n) => !n.done).map((n) => n.text).slice(0, 20),
    dueRepeating: freeDue(s, today, true).map((f) => f.title),
    routines: s.routines.map((r) => ({ title: r.title, days: r.days.map((d) => DAY_SHORT[d]).join(" "), start: r.start, minutes: r.dur })).slice(0, 30),
    projects: activeProjects(s).map((p) => ({
      name: p.name,
      why: cut(p.why, 200),
      nextStep: nextStep(s, p.id)?.text,
      openSteps: stepsOf(s, p.id).filter((x) => !x.done).slice(0, 8).map((x) => x.text),
      doneSteps: stepsOf(s, p.id).filter((x) => x.done).length,
      goals: pagesOf(s, p.id, "goal").filter((g) => !g.achieved).slice(0, 5).map((g) => ({ goal: cut(g.title || g.text, 160), target: g.target })),
      notes: pagesOf(s, p.id).filter((x) => x.kind !== "goal").slice(0, 3).map((x) => cut(`${x.title ? `${x.title}: ` : ""}${x.text}`, 300)),
    })),
    goals: pagesOf(s, JOURNAL, "goal").filter((g) => !g.achieved).slice(0, 8).map((g) => ({ goal: cut(g.title || g.text, 160), target: g.target })),
    journal: pagesOf(s, JOURNAL, "journal").slice(0, 3).map((x) => cut(x.text, 300)),
    history: {
      followThrough14d: st.rate,
      topReasonsMissed: top(st.barriers, BARRIER_LABEL, 3),
      timeWentInsteadTo: top(st.instead, INSTEAD_LABEL, 3),
      timeMultiplier: mx ? Math.round(mx * 100) / 100 : null,
      doneByPartOfDay: Object.fromEntries(Object.entries(byPart).map(([k, v]) => [k, `${Math.round((v.ok / v.n) * 100)}% of ${v.n}`])),
      lastDaysLogged: lastDays,
    },
  };
}

/** One suggested change to the schedule, as Claude returns it. */
export interface RawSuggestion {
  type: "add" | "move";
  block_id: string | null;
  date: string;
  title: string;
  start: string;
  minutes: number;
  category: string | null;
  why: string;
}

export type Suggestion =
  | { kind: "add"; key: string; date: string; title: string; start: number; dur: number; category: string; why: string }
  | { kind: "move"; key: string; date: string; taskId: string; title: string; from: string; start: number; dur: number; why: string };

const HHMM = /^\d{1,2}:\d{2}$/;

/**
 * Check Claude's suggestions against the real schedule (taken together, in order). Rejected: unknown or
 * fixed / logged blocks, other days than the next week, times in the past or outside the day, and anything
 * that would overlap another block. Returns the valid ones and how many were left out.
 */
export function checkSuggestions(raw: unknown, s: State, today: string, now: number): { ok: Suggestion[]; dropped: number } {
  const list = Array.isArray(raw) ? raw : [];
  const cats = new Set(categoriesOf(s).map((c) => c.key));
  const last = addDays(today, DAYS_AHEAD - 1);
  // a working copy of each touched day: id → [start, end]
  const dayCache: Record<string, { id: string; s: number; e: number }[]> = {};
  const dayOf = (d: string) => (dayCache[d] ||= tasksFor(s, d).filter((t) => t.status !== "skipped").map((t) => ({ id: t.id, s: toMin(t.start), e: toMin(t.start) + t.dur })));
  const ok: Suggestion[] = [];
  let dropped = 0;
  list.forEach((x: Partial<RawSuggestion>, i) => {
    const date = typeof x.date === "string" ? x.date : "";
    const dur = typeof x.minutes === "number" ? Math.round(x.minutes) : 0;
    const start = typeof x.start === "string" && HHMM.test(x.start) ? toMin(x.start) : -1;
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date <= last && dur >= 5 && dur <= 600
      && start >= 0 && start + dur <= 1440 && !(date === today && start < now - 5);
    if (!valid) { dropped++; return; }
    const blocks = dayOf(date);
    let moving: Task | undefined;
    if (x.type === "move") {
      moving = tasksFor(s, date).find((t) => t.id === x.block_id);
      if (!moving || moving.fixed || moving.status !== "open") { dropped++; return; }
    } else if (x.type !== "add" || !(typeof x.title === "string" && x.title.trim())) { dropped++; return; }
    const others = blocks.filter((b) => b.id !== moving?.id);
    if (others.some((b) => start < b.e && start + dur > b.s)) { dropped++; return; }
    // later suggestions see this one
    dayCache[date] = [...others, { id: moving?.id || `new${i}`, s: start, e: start + dur }];
    const why = typeof x.why === "string" ? x.why.slice(0, 240) : "";
    if (moving) ok.push({ kind: "move", key: `m${i}`, date, taskId: moving.id, title: moving.title, from: moving.start, start, dur, why });
    else ok.push({ kind: "add", key: `a${i}`, date, title: x.title!.trim().slice(0, 80), start, dur, category: x.category && cats.has(x.category) ? x.category : "me", why });
  });
  return { ok, dropped };
}

/** Apply one approved suggestion. Mutates the draft; false if it no longer fits (the schedule changed). */
export function applySuggestion(s: State, sg: Suggestion, at: Date = new Date()): boolean {
  const day = tasksFor(s, sg.date).filter((t) => t.status !== "skipped" && t.id !== (sg.kind === "move" ? sg.taskId : ""));
  if (day.some((t) => sg.start < toMin(t.start) + t.dur && sg.start + sg.dur > toMin(t.start))) return false;
  if (sg.kind === "add") {
    s.tasks.push({ id: uid(), date: sg.date, title: sg.title, start: fmt(sg.start), dur: sg.dur, category: sg.category, status: "open", emoji: suggestEmoji(sg.title, sg.category, s) });
    return true;
  }
  const t = tasksFor(s, sg.date).find((x) => x.id === sg.taskId);
  if (!t || t.fixed || t.status !== "open") return false;
  moveTask(materialize(s, t), fmt(sg.start), sg.dur, "ai", at);
  return true;
}
