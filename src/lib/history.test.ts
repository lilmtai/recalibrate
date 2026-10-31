import { describe, expect, it } from "vitest";
import { applyPulled, changedSince, fingerprint, fromRow, keepHistory, pruneOld, toRow, type Snapshot } from "./history";
import { state, TODAY } from "../test/fixtures";
import type { Actual } from "../types";

const entry = (p: Partial<Actual> = {}): Actual => ({ id: "a1", date: TODAY, start: 540, end: 600, title: "Coding", kind: "free", ...p });

describe("history rows", () => {
  it("round-trips an entry through a table row", () => {
    const a = entry({ category: "work", insteadKey: "phone", taskId: "t", promptKey: "wyd:x:600", auto: true });
    expect(fromRow(toRow(a))).toEqual(a);
    const running = entry({ end: undefined });
    expect(fromRow(toRow(running)).end).toBeUndefined();
  });
  it("uploads only new or edited entries", () => {
    const a = entry(), b = entry({ id: "b" });
    const snap: Snapshot = { a1: fingerprint(a), b: fingerprint(b) };
    expect(changedSince([a, b], snap)).toEqual([]);
    expect(changedSince([{ ...a, title: "Email" }, b], snap).map((x) => x.id)).toEqual(["a1"]);
    expect(changedSince([a, b, entry({ id: "c" })], snap).map((x) => x.id)).toEqual(["c"]);
  });
});

describe("applying other devices' changes", () => {
  it("adds, updates and removes by id", () => {
    const s = state({ actuals: [entry(), entry({ id: "b" })] });
    applyPulled(s, [{ ...toRow(entry({ title: "Email" })) }, { ...toRow(entry({ id: "b" })), deleted: true }, toRow(entry({ id: "c" }))]);
    expect(s.actuals.map((a) => [a.id, a.title]).sort()).toEqual([["a1", "Email"], ["c", "Coding"]]);
    expect(s.actualTomb).toBeUndefined(); // a pulled deletion isn't sent back
  });
  it("one answer per prompt: the server's copy replaces a local duplicate", () => {
    const s = state({ actuals: [entry({ id: "mine", promptKey: "wyd:d:600" })] });
    applyPulled(s, [toRow(entry({ id: "theirs", promptKey: "wyd:d:600", title: "Gym" }))]);
    expect(s.actuals.map((a) => a.id)).toEqual(["theirs"]);
  });
});

describe("keeping the phone light", () => {
  it("drops synced entries older than the window, keeps unsynced ones", () => {
    const old = entry({ id: "old", date: "2026-08-01" }), oldUnsynced = entry({ id: "u", date: "2026-08-01" }), recent = entry();
    const s = state({ actuals: [old, oldUnsynced, recent] });
    pruneOld(s, "2026-09-05", { old: fingerprint(old), a1: fingerprint(recent) });
    expect(s.actuals.map((a) => a.id).sort()).toEqual(["a1", "u"]);
  });
  it("a planner copy without history never wipes the local log", () => {
    expect(keepHistory([], [entry()]).map((a) => a.id)).toEqual(["a1"]);
    expect(keepHistory([entry({ title: "Server" })], [entry({ title: "Local" })])[0].title).toBe("Server");
  });
});
