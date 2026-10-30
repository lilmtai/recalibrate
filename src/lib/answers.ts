import type { State } from "../types";
import { materialize, tasksFor } from "./plan";
import { scoreRules } from "./actions";
import { syncActuals } from "./actuals";

const PENDING = "recalibrate-pending";
type Answer = { act: "on" | "done"; task: string | null; date: string | null; at: number };

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
  const ready = answers.filter(({ a }) => a.task && a.date && tasksFor(s0, a.date).some((t) => t.id === a.task));
  // answers for blocks this device hasn't synced yet wait up to a day
  const stale = answers.filter((x) => !ready.includes(x) && Date.now() - x.a.at > 86_400_000);
  const logged: string[] = [];
  if (ready.length) {
    update((s) => {
      for (const { a } of ready.sort((x, y) => x.a.at - y.a.at)) {
        const t = tasksFor(s, a.date!).find((x) => x.id === a.task);
        if (!t || t.status !== "open") continue;
        const real = materialize(s, t);
        const d = new Date(a.at);
        const minute = d.getHours() * 60 + d.getMinutes();
        if (a.act === "on") {
          (real.checks ||= []).push({ at: minute, on: true });
          logged.push(`on ${real.title}`);
        } else {
          real.status = "done";
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
