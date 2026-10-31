import { describe, expect, it } from "vitest";
import { pullHistory, pushHistory, type HistoryDb } from "./historySync";
import type { HistoryRow, Snapshot } from "./history";
import { dropActuals, logSpan } from "./actuals";
import { state, TODAY } from "../test/fixtures";
import type { State } from "../types";

/** In-memory execution_log with the same rules as the SQL: upsert by id, unique (user, prompt_key), soft delete. */
function fakeServer() {
  const rows = new Map<string, HistoryRow & { user_id: string }>();
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 4, 0, 0, clock++)).toISOString();
  const db: HistoryDb = {
    async upsert(batch) {
      for (const r of batch) {
        const clash = r.prompt_key && [...rows.values()].find((x) => x.prompt_key === r.prompt_key && x.id !== r.id);
        if (clash) return { error: { code: "23505", message: "duplicate prompt" } };
      }
      for (const r of batch) rows.set(r.id, { ...r, updated_at: stamp() });
      return { error: null };
    },
    async markDeleted(ids) { ids.forEach((id) => { const r = rows.get(id); if (r) rows.set(id, { ...r, deleted: true, updated_at: stamp() }); }); return { error: null }; },
    async changesSince(since) { return { data: [...rows.values()].filter((r) => r.updated_at! > since).sort((a, b) => a.updated_at!.localeCompare(b.updated_at!)), error: null }; },
  };
  return { db, rows };
}

/** A device: its own state, snapshot and pull mark. */
function device(initial: State) {
  let s = initial;
  const snap: Snapshot = {};
  let since = "1970-01-01T00:00:00Z";
  const update = (fn: (d: State) => void) => { const d = structuredClone(s); fn(d); s = d; };
  return {
    get s() { return s; }, update, snap,
    push: (db: HistoryDb) => pushHistory(db, "u1", () => s, update, snap),
    pull: async (db: HistoryDb, keepFrom = "2026-01-01") => { since = await pullHistory(db, () => s, update, snap, since, keepFrom); },
  };
}

describe("history sync across two devices", () => {
  it("first sign-in uploads everything already on the phone, then only changes", async () => {
    const { db, rows } = fakeServer();
    const phone = device(state());
    phone.update((d) => { logSpan(d, TODAY, 540, 600, { title: "Coding", kind: "free" }); logSpan(d, TODAY, 600, 660, { title: "Email", kind: "free" }); });
    expect(await phone.push(db)).toBe(true);
    expect(rows.size).toBe(2);
    const before = [...rows.values()].map((r) => r.updated_at);
    await phone.push(db); // nothing changed → nothing re-sent
    expect([...rows.values()].map((r) => r.updated_at)).toEqual(before);
  });

  it("an entry made on the phone shows up on the laptop, edits and deletions too", async () => {
    const { db } = fakeServer();
    const phone = device(state()), laptop = device(state());
    phone.update((d) => logSpan(d, TODAY, 540, 600, { title: "Coding", kind: "free" }));
    await phone.push(db);
    await laptop.pull(db);
    expect(laptop.s.actuals.map((a) => a.title)).toEqual(["Coding"]);

    phone.update((d) => { d.actuals[0].title = "Deep work"; });
    await phone.push(db);
    await laptop.pull(db);
    expect(laptop.s.actuals[0].title).toBe("Deep work");

    phone.update((d) => dropActuals(d, () => true));
    await phone.push(db);
    expect(phone.s.actualTomb).toEqual([]);
    await laptop.pull(db);
    expect(laptop.s.actuals).toEqual([]);
  });

  it("the same hourly prompt answered on two devices is logged once", async () => {
    const { db, rows } = fakeServer();
    const phone = device(state()), laptop = device(state());
    phone.update((d) => logSpan(d, TODAY, 540, 600, { title: "Gym", kind: "free", promptKey: `wyd:${TODAY}:600` }));
    laptop.update((d) => logSpan(d, TODAY, 540, 600, { title: "Phone", kind: "free", promptKey: `wyd:${TODAY}:600` }));
    await phone.push(db);
    await laptop.push(db); // refused by the unique prompt rule → laptop drops its copy
    await laptop.pull(db); // and takes the phone's
    expect(rows.size).toBe(1);
    expect(laptop.s.actuals.map((a) => a.title)).toEqual(["Gym"]);
  });

  it("old days leave the phone once they're safely on the server, never before", async () => {
    const { db } = fakeServer();
    const phone = device(state());
    phone.update((d) => logSpan(d, "2026-08-01", 540, 600, { title: "Old", kind: "free" }));
    await phone.pull(db, "2026-09-05"); // not uploaded yet → kept
    expect(phone.s.actuals).toHaveLength(1);
    await phone.push(db);
    await phone.pull(db, "2026-09-05"); // uploaded → pruned from the phone
    expect(phone.s.actuals).toHaveLength(0);
  });
});
