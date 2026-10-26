import { useCallback, useEffect, useState } from "react";
import type { State } from "./types";

const KEY = "recalibrate.v1";
export const blank = (): State => ({ v: 2, tasks: [], routines: [], rules: [], checkins: {} });

/** Upgrades data saved by the first single-file version. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(raw: any): State {
  const s = { ...blank(), ...raw };
  s.tasks = (s.tasks || []).map((t: any) => ({
    ...t,
    category: t.category || "work",
    energy: t.energy || undefined,
    ifNot: t.ifNot ?? t.minVersion,
    status: t.status === "min" ? "ifnot" : t.status,
  }));
  s.rules = (s.rules || []).map((r: any) => ({
    ...r,
    remind: r.remind || (r.lead >= 720 ? { kind: "at", time: "21:00", dayBefore: true } : { kind: "before", lead: r.lead ?? 60 }),
    wins: r.wins || 0,
    fails: r.fails || 0,
  }));
  s.routines = s.routines || [];
  s.v = 2;
  return s;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    /* storage unavailable: start empty */
  }
  return blank();
}

export function useAppState() {
  const [state, setState] = useState<State>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);
  /** Change state by editing a copy; React re-renders with the copy. */
  const update = useCallback((fn: (draft: State) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      draft.updatedAt = Date.now();
      return draft;
    });
  }, []);
  /** Swap in a whole state (from sync) without marking it as a local edit. */
  const replace = useCallback((next: State) => setState(migrate(next)), []);
  return { state, update, replace };
}
