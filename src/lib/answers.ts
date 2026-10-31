import type { State } from "../types";
import { materialize, tasksFor } from "./plan";
import { freeDone, freeLater, markEnded, markStarted, scoreRules } from "./actions";
import { logSame, logSpan, syncActuals, wydFrom } from "./actuals";
import { toMin } from "./time";

const PENDING = "recalibrate-pending";
type Answer = { act: "on" | "done" | "fdone" | "flater" | "wplan" | "wsame"; task: string | null; free?: string | null; date: string | null; prompt?: string | null; at: number };
const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/**
 * Apply answers given straight from notification buttons ("I'm on it", "Done").
 * The service worker saves them; the app records them the next time it runs.
 * Returns the titles that were logged, for a short confirmation.
 */
export async function applyNotificationAnswers(getState: () => State, update: (fn: (s: State) => void) => void): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(PENDING);
  const keys = await cache.keys();
  if (!keys.length) return [];
  const answers: { key: Request; a: Answer }[] = [];
  for (const key of keys) {
    try { answers.push({ key, a: await (await cache.match(key))!.json() }); } catch { await cache.delete(key); }
  }
  const s0 = getState();
  const isFree = (a: Answer) => a.act === "fdone" || a.act === "flater";
  const ready = answers.filter(({ a }) => a.act === "wsame" ? true
    : isFree(a) ? (s0.free || []).some((f) => f.id === a.free)
    : a.task && a.date && tasksFor(s0, a.date).some((t) => t.id === a.task));
  // answers for blocks this device hasn't synced yet wait up to a day
  const stale = answers.filter((x) => !ready.includes(x) && Date.now() - x.a.at > 86_400_000);
  const logged: string[] = [];
  if (ready.length) {
    update((s) => {
      for (const { a } of ready.sort((x, y) => x.a.at - y.a.at)) {
        const day = a.date || localDay(a.at);
        const at = new Date(a.at).getHours() * 60 + new Date(a.at).getMinutes();
        // one answer per hourly prompt, even if it's answered on two devices
        const promptKey = a.prompt ? `wyd:${day}:${a.prompt}` : undefined;
        if (a.act === "wsame") {
          const title = logSame(s, day, at, promptKey);
          if (title) logged.push(`still ${title}`);
          continue;
        }
        if (a.act === "wplan") {
          const t = tasksFor(s, day).find((x) => x.id === a.task);
          if (!t) continue;
          const from = Math.max(wydFrom(s, day, at), toMin(t.start));
          logSpan(s, day, from, at, { title: t.title, kind: "plan", category: t.category, taskId: t.id, promptKey });
          const d0 = new Date(a.at); d0.setHours(Math.floor(from / 60), from % 60, 0, 0);
          markStarted(materialize(s, t), d0);
          logged.push(`on ${t.title}`);
          continue;
        }
        if (isFree(a)) {
          const f = s.free.find((x) => x.id === a.free);
          if (!f) continue;
          if (a.act === "fdone") { freeDone(s, f.id, localDay(a.at)); logged.push(`${f.title} done`); }
          else { freeLater(s, f.id, localDay(a.at)); logged.push(`${f.title} moved to tomorrow`); }
          continue;
        }
        const t = tasksFor(s, a.date!).find((x) => x.id === a.task);
        if (!t || t.status !== "open") continue;
        const real = materialize(s, t);
        const d = new Date(a.at);
        const minute = d.getHours() * 60 + d.getMinutes();
        if (a.act === "on") {
          (real.checks ||= []).push({ at: minute, on: true });
          markStarted(real, new Date(a.at));
          logged.push(`on ${real.title}`);
        } else {
          real.status = "done";
          markEnded(real, new Date(a.at));
          scoreRules(s, real, true);
          syncActuals(s, real);
          logged.push(`${real.title} done`);
        }
      }
    });
  }
  await Promise.all([...ready, ...stale].map(({ key }) => cache.delete(key)));
  return logged;
}
