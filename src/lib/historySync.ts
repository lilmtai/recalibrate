import { applyPulled, changedSince, fingerprint, fromRow, pruneOld, toRow, type HistoryRow, type Snapshot } from "./history";
import type { State } from "../types";

/** The few Supabase calls history sync needs (the real client, or a fake in tests). */
export interface HistoryDb {
  upsert(rows: (HistoryRow & { user_id: string })[]): Promise<{ error: { code?: string; message?: string } | null }>;
  markDeleted(ids: string[]): Promise<{ error: { code?: string; message?: string } | null }>;
  changesSince(since: string): Promise<{ data: HistoryRow[] | null; error: { code?: string; message?: string } | null }>;
}
type Update = (fn: (s: State) => void) => void;

/** Upload new/edited entries and pending deletions. Returns false if anything failed (retry later). */
export async function pushHistory(db: HistoryDb, userId: string, getState: () => State, update: Update, snap: Snapshot): Promise<boolean> {
  const s = getState();
  const changed = changedSince(s.actuals, snap);
  let ok = true;
  for (let i = 0; i < changed.length; i += 400) {
    const chunk = changed.slice(i, i + 400);
    const { error } = await db.upsert(chunk.map((a) => ({ ...toRow(a), user_id: userId })));
    if (!error) { chunk.forEach((a) => (snap[a.id] = fingerprint(a))); continue; }
    if (error.code !== "23505") { ok = false; break; }
    // a prompt already answered on another device: keep theirs (the next pull brings it), drop ours
    for (const a of chunk) {
      const r = await db.upsert([{ ...toRow(a), user_id: userId }]);
      if (!r.error) snap[a.id] = fingerprint(a);
      else if (r.error.code === "23505") update((d) => { d.actuals = d.actuals.filter((x) => x.id !== a.id); });
      else ok = false;
    }
  }
  const tomb = getState().actualTomb || [];
  if (tomb.length) {
    const { error } = await db.markDeleted(tomb);
    if (!error) {
      tomb.forEach((id) => delete snap[id]);
      update((d) => { d.actualTomb = (d.actualTomb || []).filter((id) => !tomb.includes(id)); });
    } else ok = false;
  }
  return ok;
}

/** Bring in changes since `since`, prune days before `keepFrom`. Returns the new "since" mark. */
export async function pullHistory(db: HistoryDb, getState: () => State, update: Update, snap: Snapshot, since: string, keepFrom: string): Promise<string> {
  const { data, error } = await db.changesSince(since);
  if (error) return since;
  const rows = data || [];
  for (const r of rows) {
    if (r.deleted) delete snap[r.id];
    else snap[r.id] = fingerprint(fromRow(r));
  }
  const needsPrune = getState().actuals.some((a) => a.date < keepFrom && snap[a.id] === fingerprint(a));
  if (rows.length || needsPrune) update((d) => { applyPulled(d, rows); pruneOld(d, keepFrom, snap); });
  return rows.length ? rows[rows.length - 1].updated_at || since : since;
}
