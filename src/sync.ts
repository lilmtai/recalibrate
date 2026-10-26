import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import type { State } from "./types";

export type SyncStatus = "signedout" | "syncing" | "synced" | "offline" | "error";

const META = "recalibrate.sync";
type Meta = { userId: string; syncedAt: number };
const readMeta = (): Meta | null => {
  try { return JSON.parse(localStorage.getItem(META) || "null"); } catch { return null; }
};
const writeMeta = (m: Meta) => { try { localStorage.setItem(META, JSON.stringify(m)); } catch { /* ignore */ } };

/** Combine two planners: keep everything from both, newer copy wins when the same item exists twice. */
export function merge(a: State, b: State): State {
  const [older, newer] = (a.updatedAt || 0) <= (b.updatedAt || 0) ? [a, b] : [b, a];
  const byId = <T extends { id: string }>(x: T[], y: T[]) => {
    const m = new Map<string, T>();
    for (const i of x) m.set(i.id, i);
    for (const i of y) m.set(i.id, i);
    return [...m.values()];
  };
  return {
    v: 2,
    tasks: byId(older.tasks, newer.tasks),
    routines: byId(older.routines, newer.routines),
    rules: byId(older.rules, newer.rules),
    checkins: { ...older.checkins, ...newer.checkins },
    updatedAt: Date.now(),
  };
}

const hasData = (s: State) => s.tasks.length + s.routines.length + s.rules.length > 0;

/**
 * Keeps the planner in sync with Supabase when signed in.
 * Local-first: the app always works from localStorage; sync pushes edits
 * (debounced) and pulls on sign-in, on focus and every minute.
 */
export function useSync(state: State, replace: (s: State) => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>("signedout");
  const stateRef = useRef(state);
  stateRef.current = state;
  const busy = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const push = useCallback(async (s: State) => {
    if (!userId) return;
    setStatus("syncing");
    const at = new Date();
    const { error } = await supabase.from("planner_state").upsert({ user_id: userId, data: s, updated_at: at.toISOString() });
    if (error) return setStatus(navigator.onLine ? "error" : "offline");
    writeMeta({ userId, syncedAt: at.getTime() });
    setStatus("synced");
  }, [userId]);

  const pull = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    setStatus("syncing");
    try {
      const { data, error } = await supabase.from("planner_state").select("data, updated_at").eq("user_id", userId).maybeSingle();
      if (error) { setStatus(navigator.onLine ? "error" : "offline"); return; }
      const local = stateRef.current;
      const meta = readMeta();
      if (!data) { await push(local); return; }

      const remote = data.data as State;
      const remoteAt = Date.parse(data.updated_at);
      const firstTimeHere = meta?.userId !== userId;
      const localEdits = (local.updatedAt || 0) > (meta?.syncedAt || 0);

      if (firstTimeHere) {
        if (hasData(local)) {
          const m = merge(remote, local);
          replace(m);
          await push(m);
        } else {
          replace(remote);
          writeMeta({ userId, syncedAt: remoteAt });
          setStatus("synced");
        }
      } else if (remoteAt > (meta?.syncedAt || 0)) {
        if (localEdits) {
          const m = merge(remote, local);
          replace(m);
          await push(m);
        } else {
          replace(remote);
          writeMeta({ userId, syncedAt: remoteAt });
          setStatus("synced");
        }
      } else if (localEdits) {
        await push(local);
      } else {
        setStatus("synced");
      }
    } finally {
      busy.current = false;
    }
  }, [userId, push, replace]);

  // pull on sign-in, when the tab regains focus, and every minute
  useEffect(() => {
    if (!userId) { setStatus("signedout"); return; }
    pull();
    const onFocus = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const t = setInterval(pull, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [userId, pull]);

  // push local edits shortly after they happen
  useEffect(() => {
    if (!userId || busy.current) return;
    const meta = readMeta();
    if (meta?.userId !== userId || (state.updatedAt || 0) <= meta.syncedAt) return;
    const t = setTimeout(() => push(stateRef.current), 1200);
    return () => clearTimeout(t);
  }, [state, userId, push]);

  const signIn = async (email: string) => {
    const redirect = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    return error?.message || null;
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem(META); } catch { /* ignore */ }
  };

  return { email: session?.user.email || null, status, signIn, signOut, syncNow: pull };
}
