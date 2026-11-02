/**
 * "Tell me about your day": the app side of the voice / text day log (pure, tested).
 * buildVoiceRequest → the Edge Function "log-day" (Claude) → parseVoiceResult checks every item against the
 * real plan and lists → the user approves or unticks items → applyVoice saves them. Nothing is saved before
 * approval (docs/AI_BEHAVIOUR.md), and blocks already logged are never overwritten.
 */
import type { BarrierKey, InsteadKey, State, Task } from "../types";
import { BARRIERS, INSTEAD, categoriesOf } from "../constants";
import { fmt, toMin, uid } from "./time";
import { materialize, tasksFor } from "./plan";
import { completeTask, markEnded, markStarted, scoreRules } from "./actions";
import { logSpan, syncActuals } from "./actuals";

export type VoiceItem =
  | { kind: "block"; id: string; taskId: string; title: string; status: "done" | "partial" | "missed" | "ifnot"; minutes?: number; reason?: BarrierKey; note?: string }
  | { kind: "extra"; id: string; title: string; start: number; end: number; category?: string; instead?: InsteadKey; guessedEnd: boolean }
  | { kind: "energy"; id: string; energy: "low" | "steady" | "high" }
  | { kind: "sleep"; id: string; hours: number }
  | { kind: "todo"; id: string; text: string };

export interface VoiceProposal {
  items: VoiceItem[];
  summary: string;
  /** things Claude mentioned that couldn't be logged (no time, unknown block…) */
  skipped: string[];
}

export function buildVoiceRequest(s: State, date: string, text: string, now: number | null) {
  return {
    text: text.trim(),
    date,
    now: now === null ? null : fmt(now),
    plan: tasksFor(s, date).map((t) => ({
      id: t.id, title: t.title, start: t.start, end: fmt(toMin(t.start) + t.dur), status: t.status,
      ...(t.ifNot ? { ifNot: t.ifNot } : {}),
    })),
    categories: categoriesOf(s).map((c) => ({ key: c.key, label: c.label })),
    barriers: BARRIERS.map((b) => ({ key: b.key, label: b.label })),
    instead: INSTEAD.map((i) => ({ key: i.key, label: i.label })),
  };
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj).filter((x): x is Record<string, unknown> => !!x) : []);
const text = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const hhmm = (v: unknown): number | null => {
  if (typeof v !== "string" || !/^\d{1,2}:\d{2}$/.test(v.trim())) return null;
  const [h, m] = v.trim().split(":").map(Number);
  return h <= 24 && m < 60 && h * 60 + m <= 1440 ? h * 60 + m : null;
};

/** Check Claude's answer against the real plan and lists; anything unknown is dropped, never guessed. */
export function parseVoiceResult(raw: unknown, s: State, date: string): VoiceProposal {
  const r = obj(raw) || {};
  const tasks = tasksFor(s, date);
  const cats = new Set(categoriesOf(s).map((c) => c.key));
  const barriers = new Set<string>(BARRIERS.map((b) => b.key));
  const insteads = new Set<string>(INSTEAD.map((i) => i.key));
  const items: VoiceItem[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const b of arr(r.blocks)) {
    const t = tasks.find((x) => x.id === b.id);
    const status = b.status;
    if (!t || seen.has(t.id) || !(status === "done" || status === "partial" || status === "missed" || status === "ifnot")) continue;
    if (t.status !== "open") { skipped.push(`${t.title} (already logged)`); continue; }
    seen.add(t.id);
    const minutes = typeof b.minutes === "number" && b.minutes > 0 && b.minutes <= 1440 ? Math.round(b.minutes) : undefined;
    items.push({
      kind: "block", id: `b:${t.id}`, taskId: t.id, title: t.title, status,
      ...(minutes ? { minutes } : {}),
      ...(status !== "done" && typeof b.reason === "string" && barriers.has(b.reason) ? { reason: b.reason as BarrierKey } : {}),
      ...(text(b.note, 200) ? { note: text(b.note, 200) } : {}),
    });
  }

  arr(r.extra).forEach((e, i) => {
    const title = text(e.title, 80);
    if (!title) return;
    const start = hhmm(e.start);
    let end = hhmm(e.end);
    if (start === null) { skipped.push(`${title} (no time)`); return; }
    const guessedEnd = end === null || end <= start;
    if (guessedEnd) end = Math.min(1440, start + 30);
    items.push({
      kind: "extra", id: `e:${i}`, title, start, end: end!, guessedEnd,
      ...(typeof e.category === "string" && cats.has(e.category) ? { category: e.category } : {}),
      ...(typeof e.instead === "string" && insteads.has(e.instead) ? { instead: e.instead as InsteadKey } : {}),
    });
  });

  if (r.energy === "low" || r.energy === "steady" || r.energy === "high") items.push({ kind: "energy", id: "energy", energy: r.energy });
  if (typeof r.sleep === "number" && r.sleep > 0 && r.sleep <= 16) items.push({ kind: "sleep", id: "sleep", hours: Math.round(r.sleep * 2) / 2 });
  const todos = Array.isArray(r.todos) ? r.todos : [];
  todos.forEach((t, i) => { const x = text(t, 140); if (x) items.push({ kind: "todo", id: `t:${i}`, text: x }); });

  return { items, summary: text(r.summary, 240), skipped };
}

/** Save the approved items. Mutates the draft; returns how many were saved. */
export function applyVoice(s: State, date: string, items: VoiceItem[], at: Date = new Date()): number {
  let n = 0;
  for (const it of items) {
    if (it.kind === "block") {
      const t = tasksFor(s, date).find((x: Task) => x.id === it.taskId);
      if (!t || t.status !== "open") continue; // logged meanwhile: never overwrite
      const real = materialize(s, t);
      if (it.status === "done") {
        completeTask(s, real, at);
        if (it.minutes) real.actual = it.minutes;
      } else if (it.status === "ifnot") {
        real.status = "ifnot"; markEnded(real, at); scoreRules(s, real, true);
      } else if (it.status === "partial") {
        real.status = "partial"; markStarted(real, at); markEnded(real, at);
        real.share = it.minutes ? Math.min(0.75, Math.max(0.25, Math.round((it.minutes / real.dur) * 4) / 4)) : 0.5;
        if (it.reason) real.barrier = it.reason;
        scoreRules(s, real, true);
      } else {
        real.status = "missed";
        if (it.reason) real.barrier = it.reason;
        scoreRules(s, real, false);
      }
      if (it.note) real.note = it.note;
      syncActuals(s, real);
    } else if (it.kind === "extra") {
      logSpan(s, date, it.start, it.end, { title: it.title, kind: it.instead ? "instead" : "free", category: it.category, insteadKey: it.instead });
    } else if (it.kind === "energy") {
      s.checkins[date] = { ...(s.checkins[date] || {}), energy: it.energy, skipped: undefined };
    } else if (it.kind === "sleep") {
      s.checkins[date] = { ...(s.checkins[date] || {}), sleep: it.hours };
    } else {
      s.notes.push({ id: uid(), date, text: it.text, done: false });
    }
    n++;
  }
  return n;
}
