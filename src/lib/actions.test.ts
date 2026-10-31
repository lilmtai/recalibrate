import { describe, expect, it } from "vitest";
import { completeTask, freeDone, freeLater, markStarted, reopenTask, scoreRules, startState } from "./actions";
import { state, task, TODAY } from "../test/fixtures";

describe("free block actions", () => {
  const base = () => state({ free: [{ id: "f", title: "Barbershop", category: "me", everyDays: 14, nextDue: "2026-11-01", remindAt: "10:00" }] });
  it("done moves the next due date forward from the day it was done", () => {
    const s = base();
    freeDone(s, "f", TODAY);
    expect(s.free[0]).toMatchObject({ nextDue: "2026-11-18", lastDone: TODAY });
  });
  it("a one-off disappears when done", () => {
    const s = base();
    s.free[0].everyDays = 0;
    freeDone(s, "f", TODAY);
    expect(s.free).toEqual([]);
  });
  it("tomorrow snoozes by one day", () => {
    const s = base();
    freeLater(s, "f", TODAY);
    expect(s.free[0].nextDue).toBe("2026-11-05");
  });
});

describe("playbook scoring", () => {
  it("counts wins and fails only once the rule existed", () => {
    const s = state({ rules: [{ id: "r", match: "gym", barrier: "energy", fix: "Snack", remind: { kind: "before", lead: 60 }, created: TODAY, wins: 0, fails: 0 }] });
    scoreRules(s, task({ title: "Gym", date: "2026-11-01" }), true); // before the rule
    scoreRules(s, task({ title: "Gym" }), true);
    scoreRules(s, task({ title: "Evening gym" }), false);
    expect(s.rules[0]).toMatchObject({ wins: 1, fails: 1 });
  });
});

describe("start and finish", () => {
  it("records the first real start only", () => {
    const t = task();
    markStarted(t, new Date(2026, 10, 4, 9, 5));
    markStarted(t, new Date(2026, 10, 4, 9, 40));
    expect(new Date(t.startedAt!).getMinutes()).toBe(5);
  });
  it("tells never-started from started-but-unfinished", () => {
    expect(startState(task({ status: "missed" }))).toBe("not_started");
    expect(startState(task({ status: "missed", startedAt: "2026-11-04T09:05:00Z" }))).toBe("started");
    expect(startState(task({ status: "partial" }))).toBe("started");
    expect(startState(task({ status: "done" }))).toBe("finished");
  });
});

describe("one-tap done and ongoing blocks", () => {
  it("an ongoing block becomes as long as it really ran", () => {
    const s = state();
    const t = task({ start: "14:00", dur: 30, ongoing: true });
    completeTask(s, t, new Date(2026, 10, 4, 16, 10));
    expect(t).toMatchObject({ status: "done", dur: 130, actual: 130 });
    expect(t.ongoing).toBeUndefined();
  });
  it("a normal block keeps its planned length, and can be reopened", () => {
    const s = state();
    const t = task({ dur: 45 });
    completeTask(s, t, new Date(2026, 10, 4, 10, 0));
    expect(t).toMatchObject({ status: "done", dur: 45 });
    reopenTask(t);
    expect(t.status).toBe("open");
  });
});
