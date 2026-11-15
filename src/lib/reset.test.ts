import { describe, expect, it } from "vitest";
import { freshState } from "./reset";
import { merge } from "../sync";
import { routine, state, task, TODAY } from "../test/fixtures";

const full = () => state({
  tasks: [task({ id: "t1" })],
  routines: [routine()],
  notes: [{ id: "n1", date: TODAY, text: "Buy milk", done: false }],
  actuals: [{ id: "a1", date: TODAY, start: 600, end: 660, title: "Gym", kind: "free" }],
  projects: [{ id: "p1", name: "Content", area: "side", status: "active", created: TODAY }],
  checkins: { [TODAY]: { energy: "low" } },
  categories: [{ key: "work", label: "Job", color: "#000000", emoji: "💼" }],
  notify: { enabled: true, start: true, mid: false, end: true, fix: true },
  updatedAt: 1000,
});

describe("Start fresh", () => {
  it("clears what you planned, logged and wrote; keeps your settings", () => {
    const s = freshState(full(), 5000);
    expect(s.tasks).toEqual([]);
    expect(s.routines).toEqual([]);
    expect(s.notes).toEqual([]);
    expect(s.actuals).toEqual([]);
    expect(s.projects).toEqual([]);
    expect(s.checkins).toEqual({});
    expect(s.categories?.[0].label).toBe("Job");
    expect(s.dayHours).toEqual({ start: "07:00", end: "23:00" });
    expect(s.notify?.mid).toBe(false);
    // the log entries are marked deleted on the server too
    expect(s.actualTomb).toEqual(["a1"]);
    expect(s).toMatchObject({ resetAt: 5000, updatedAt: 5000, onboarded: true });
  });

  it("an old copy on another device never brings the data back, whichever is newer", () => {
    const fresh = freshState(full(), 5000);
    const oldDevice = { ...full(), updatedAt: 9000 }; // edited later, but hasn't seen the reset
    for (const m of [merge(fresh, oldDevice), merge(oldDevice, fresh)]) {
      expect(m.tasks).toEqual([]);
      expect(m.routines).toEqual([]);
      expect(m.resetAt).toBe(5000);
    }
  });

  it("after the reset, devices merge normally again (and categories are kept)", () => {
    const fresh = freshState(full(), 5000);
    const a = { ...fresh, tasks: [task({ id: "new1" })], updatedAt: 6000 };
    const b = { ...fresh, notes: [{ id: "n2", date: TODAY, text: "New", done: false }], updatedAt: 7000 };
    const m = merge(a, b);
    expect(m.tasks.map((t) => t.id)).toEqual(["new1"]);
    expect(m.notes.map((n) => n.id)).toEqual(["n2"]);
    expect(m.categories?.[0].label).toBe("Job");
    expect(m.resetAt).toBe(5000);
  });
});
