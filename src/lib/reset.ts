import type { State } from "../types";
import { blank } from "../store";

/**
 * "Start fresh": everything you planned, logged and wrote goes; your settings stay (categories, day hours,
 * notification choices, account). The history entries are marked deleted on the server (soft delete), and
 * `resetAt` makes sure no device brings the old data back when syncing (see `merge`). Pure.
 */
export function freshState(s: State, now = Date.now()): State {
  return {
    ...blank(),
    categories: s.categories,
    dayHours: s.dayHours,
    notify: s.notify,
    onboarded: true,
    actualTomb: [...new Set([...(s.actualTomb || []), ...s.actuals.map((a) => a.id)])],
    resetAt: now,
    updatedAt: now,
  };
}

/** A copy of everything, to download before starting fresh. */
export const backupJson = (s: State) => JSON.stringify({ app: "recalibrate", exportedAt: new Date().toISOString(), state: s }, null, 2);

/** Device-only things that belong to the old data (open chat, closed notices). */
export const LOCAL_KEYS = ["recalibrate.chat", "recalibrate.hidden"];
