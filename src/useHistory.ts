import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { changedSince, fromRow, type HistoryRow, type Snapshot } from "./lib/history";
import { pullHistory, pushHistory, type HistoryDb } from "./lib/historySync";
import { addDays, today } from "./lib/time";
import type { Actual, State } from "./types";

/** Days of history kept on the phone; older days are fetched when you open them. */
export const KEEP_DAYS = 60;

/**
 * "table": history syncs through execution_log (and is left out of planner_state).
 * "blob": the table isn't set up yet; history stays inside planner_state as before.
 * Read by sync.ts, which must not strip history until the table holds everything.
 */
export type HistoryMode = "unknown" | "blob" | "table";
let readyForTable = false;
export const historyInTable = () => readyForTable;

const snapKey = (uid: string) => `recalibrate.histsnap.${uid}`;
const pullKey = (uid: string) => `recalibrate.histpull.${uid}`;
const load = <T,>(k: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? fallback; } catch { return fallback; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
const missingTable = (e: { code?: string; message?: string }) => /PGRST205|42P01|does not exist|schema cache/i.test(`${e.code} ${e.message}`);

/** The real Supabase calls for history sync. */
const realDb = (userId: string): HistoryDb => ({
  upsert: async (rows) => supabase.from("execution_log").upsert(rows, { onConflict: "id" }),
  markDeleted: async (ids) => supabase.from("execution_log").update({ deleted: true }).in("id", ids).eq("user_id", userId),
  changesSince: async (since) => {
    const r = await supabase.from("execution_log").select("*").gt("updated_at", since).order("updated_at").limit(1000);
    return { data: (r.data || null) as HistoryRow[] | null, error: r.error };
  },
});

export function useHistory(userId: string | null, state: State, update: (fn: (s: State) => void) => void) {
  const [mode, setMode] = useState<HistoryMode>("unknown");
  const snap = useRef<Snapshot>({});
  const stateRef = useRef(state);
  stateRef.current = state;
  const busy = useRef(false);

  /** Upload new/edited entries and pending deletions. Returns false if something failed. */
  const push = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const ok = await pushHistory(realDb(userId), userId, () => stateRef.current, update, snap.current);
    save(snapKey(userId), snap.current);
    return ok;
  }, [userId, update]);

  /** Bring in other devices' changes since the last pull, and prune old days. */
  const pull = useCallback(async () => {
    if (!userId) return;
    const since = load<string>(pullKey(userId), "1970-01-01T00:00:00Z");
    const next = await pullHistory(realDb(userId), () => stateRef.current, update, snap.current, since, addDays(today(), -KEEP_DAYS));
    if (next !== since) save(pullKey(userId), next);
    save(snapKey(userId), snap.current);
  }, [userId, update]);

  // on sign-in: is the table there? If so, move everything up before planner_state stops carrying history
  useEffect(() => {
    readyForTable = false;
    if (!userId) { setMode("unknown"); return; }
    snap.current = load<Snapshot>(snapKey(userId), {});
    let cancelled = false;
    (async () => {
      const probe = await supabase.from("execution_log").select("id").limit(1);
      if (cancelled) return;
      if (probe.error) { setMode(missingTable(probe.error) ? "blob" : "unknown"); return; }
      busy.current = true;
      const ok = await push();
      busy.current = false;
      if (cancelled || !ok) return;
      readyForTable = true;
      setMode("table");
      pull();
    })();
    return () => { cancelled = true; };
  }, [userId, push, pull]);

  // after changes: upload shortly after
  useEffect(() => {
    if (mode !== "table" || busy.current) return;
    if (!changedSince(state.actuals, snap.current).length && !(state.actualTomb || []).length) return;
    const t = setTimeout(() => { push(); }, 1500);
    return () => clearTimeout(t);
  }, [state.actuals, state.actualTomb, mode, push]);

  // other devices' changes: on focus and every minute
  useEffect(() => {
    if (mode !== "table") return;
    const onFocus = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(pull, 60_000);
    return () => { document.removeEventListener("visibilitychange", onFocus); clearInterval(t); };
  }, [mode, pull]);

  return { mode };
}

/** Read-only history for a day older than what the phone keeps. */
export async function fetchDay(day: string): Promise<Actual[]> {
  const { data, error } = await supabase.from("execution_log").select("*").eq("day", day).eq("deleted", false).order("start_min");
  return error ? [] : ((data || []) as HistoryRow[]).map(fromRow);
}
