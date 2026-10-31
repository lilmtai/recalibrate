import type { Actual, CategoryKey, InsteadKey, State } from "../types";

/**
 * "What really happened" history lives in Supabase's execution_log table (supabase/history.sql).
 * These are the pure parts of that sync: row conversion, change detection, applying pulled rows,
 * pruning old days from the phone. The network part is in src/useHistory.ts.
 */

export interface HistoryRow {
  id: string;
  day: string;
  start_min: number;
  end_min: number | null;
  title: string;
  kind: Actual["kind"];
  category: string | null;
  instead_key: string | null;
  task_id: string | null;
  prompt_key: string | null;
  auto: boolean;
  deleted: boolean;
  updated_at?: string;
}

export const toRow = (a: Actual): HistoryRow => ({
  id: a.id,
  day: a.date,
  start_min: a.start,
  end_min: a.end ?? null,
  title: a.title,
  kind: a.kind,
  category: a.category ?? null,
  instead_key: a.insteadKey ?? null,
  task_id: a.taskId ?? null,
  prompt_key: a.promptKey ?? null,
  auto: !!a.auto,
  deleted: false,
});

export const fromRow = (r: HistoryRow): Actual => ({
  id: r.id,
  date: r.day,
  start: r.start_min,
  end: r.end_min ?? undefined,
  title: r.title,
  kind: r.kind,
  category: (r.category ?? undefined) as CategoryKey | undefined,
  insteadKey: (r.instead_key ?? undefined) as InsteadKey | undefined,
  taskId: r.task_id ?? undefined,
  promptKey: r.prompt_key ?? undefined,
  auto: r.auto || undefined,
});

/** What the server last confirmed for each entry, so only real changes are uploaded. */
export type Snapshot = Record<string, string>;
export const fingerprint = (a: Actual) => JSON.stringify(toRow(a));

/** Entries that are new or edited since the server last confirmed them. */
export const changedSince = (actuals: Actual[], snap: Snapshot) =>
  actuals.filter((a) => snap[a.id] !== fingerprint(a));

/**
 * Apply rows pulled from the server (other devices' changes). Mutates the draft.
 * Deleted rows remove the local copy without re-sending a deletion; others replace by id.
 */
export function applyPulled(s: State, rows: HistoryRow[]) {
  const byId = new Map(s.actuals.map((a) => [a.id, a]));
  for (const r of rows) {
    if (r.deleted) byId.delete(r.id);
    else {
      // a different local entry for the same prompt (answered on two devices): the server's wins
      if (r.prompt_key) for (const [id, a] of byId) if (a.promptKey === r.prompt_key && id !== r.id) byId.delete(id);
      byId.set(r.id, fromRow(r));
    }
  }
  s.actuals = [...byId.values()];
}

/** Keep the last `days` on the phone; older entries stay only if they haven't reached the server yet. */
export function pruneOld(s: State, keepFrom: string, snap: Snapshot) {
  s.actuals = s.actuals.filter((a) => a.date >= keepFrom || snap[a.id] !== fingerprint(a));
}

/** Union by id, used when a planner_state copy without history replaces the local one. */
export function keepHistory(remote: Actual[] | undefined, local: Actual[]): Actual[] {
  const m = new Map((remote || []).map((a) => [a.id, a]));
  for (const a of local) if (!m.has(a.id)) m.set(a.id, a);
  return [...m.values()];
}
