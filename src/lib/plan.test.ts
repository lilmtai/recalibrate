import { describe, expect, it } from "vitest";
import { cuesFor, everyLabel, freeDue, isVirtual, materialize, notesFor, notesToReview, tasksFor, unplacedFor } from "./plan";
import { routine, state, task, TODAY } from "../test/fixtures";

describe("tasksFor: routines appear every week without being re-planned", () => {
  const s = state({ routines: [routine()] });

  it("shows the routine on its weekdays (Mon / Wed / Fri)", () => {
    expect(tasksFor(s, "2026-11-04").map((t) => t.title)).toEqual(["Gym"]); // Wed
    expect(tasksFor(s, "2026-11-05")).toEqual([]); // Thu
    expect(tasksFor(s, "2026-11-13").map((t) => t.title)).toEqual(["Gym"]); // Fri next week
  });

  it("doesn't show it before it was created", () => {
    expect(tasksFor(s, "2026-10-30")).toEqual([]);
  });

  it("uses stable virtual ids, and materialize turns one into a stored task", () => {
    const [t] = tasksFor(s, TODAY);
    expect(isVirtual(t.id)).toBe(true);
    expect(t.id).toBe(`rt:r1:${TODAY}`);
    const draft = structuredClone(s);
    const real = materialize(draft, t);
    expect(isVirtual(real.id)).toBe(false);
    expect(draft.tasks).toHaveLength(1);
    // once stored, the virtual copy disappears (no duplicate)
    expect(tasksFor(draft, TODAY)).toHaveLength(1);
  });

  it("a skipped day hides only that day", () => {
    const draft = structuredClone(s);
    materialize(draft, tasksFor(draft, TODAY)[0]).status = "skipped";
    expect(tasksFor(draft, TODAY)).toEqual([]);
    expect(tasksFor(draft, "2026-11-06")).toHaveLength(1);
  });

  it("sorts by start time and hides parked (tray) blocks", () => {
    const s2 = state({ tasks: [task({ id: "b", start: "14:00" }), task({ id: "a", start: "08:00" }), task({ id: "c", unplaced: true })] });
    expect(tasksFor(s2, TODAY).map((t) => t.id)).toEqual(["a", "b"]);
    expect(unplacedFor(s2, TODAY).map((t) => t.id)).toEqual(["c"]);
  });
});

describe("cuesFor: reminder timing", () => {
  const s = state({ tasks: [task({ id: "t", start: "09:00", dur: 90 })] });
  const cues = cuesFor(s, TODAY);
  const at = (kind: string) => cues.filter((c) => c.kind === kind).map((c) => c.at);

  it("5 minutes before, halfway and at the end of a block", () => {
    expect(at("transition")).toEqual([9 * 60 - 5]);
    expect(at("mid")).toEqual([9 * 60 + 45]);
    expect(at("end")).toEqual([10 * 60 + 30]);
  });

  it("hourly WYD while awake, skipping hours where a block prompt is near", () => {
    const wyd = at("wyd");
    expect(wyd[0]).toBe(8 * 60);
    expect(wyd[wyd.length - 1]).toBe(23 * 60);
    expect(wyd).not.toContain(9 * 60); // 08:55 start prompt is within 10 min
    expect(cues.find((c) => c.kind === "wyd" && c.at === 10 * 60)?.taskId).toBe("t"); // planned block named
  });

  it("no prompts for blocks that are already logged", () => {
    const done = state({ tasks: [task({ status: "done" })] });
    expect(cuesFor(done, TODAY).filter((c) => c.kind === "mid" || c.kind === "end")).toEqual([]);
  });

  it("fix reminders: before the block, or the night before", () => {
    const s3 = state({
      tasks: [task({ id: "g", title: "Gym", start: "18:00", dur: 60, date: "2026-11-05" })],
      rules: [
        { id: "r", match: "gym", barrier: "forgot", fix: "Set an alarm", remind: { kind: "at", time: "21:00", dayBefore: true }, created: "2026-11-01", wins: 0, fails: 0 },
      ],
    });
    const eve = cuesFor(s3, TODAY).filter((c) => c.kind === "fix");
    expect(eve).toHaveLength(1);
    expect(eve[0]).toMatchObject({ at: 21 * 60, tomorrow: true, text: "Set an alarm" });
  });
});

describe("free blocks", () => {
  const s = state({ free: [{ id: "f", title: "Barbershop", category: "me", everyDays: 14, nextDue: "2026-11-03", remindAt: "10:00" }] });
  it("are due on their day and stay listed today while overdue", () => {
    expect(freeDue(s, TODAY, true)).toHaveLength(1);
    expect(freeDue(s, "2026-11-05", false)).toHaveLength(0);
  });
  it("remind daily while due or overdue", () => {
    expect(cuesFor(s, TODAY).filter((c) => c.kind === "free")).toHaveLength(1);
  });
  it("label intervals in plain words", () => {
    expect([7, 14, 30, 90, 10].map(everyLabel)).toEqual(["week", "2 weeks", "month", "3 months", "10 days"]);
  });
});

describe("to-dos never roll over by themselves", () => {
  const s = state({ notes: [
    { id: "old", date: "2026-11-02", text: "Call bank", done: false },
    { id: "oldDone", date: "2026-11-02", text: "Gym bag", done: true, doneDate: "2026-11-02" },
    { id: "now", date: TODAY, text: "Groceries", done: false },
    { id: "lateDone", date: "2026-11-03", text: "Reply Jonas", done: true, doneDate: TODAY },
  ] });
  it("today shows today's to-dos and ones finished today, not old open ones", () => {
    expect(notesFor(s, TODAY, true).map((n) => n.id).sort()).toEqual(["lateDone", "now"]);
  });
  it("old unfinished ones wait for a review", () => {
    expect(notesToReview(s, TODAY).map((n) => n.id)).toEqual(["old"]);
  });
});
