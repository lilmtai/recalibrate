import { describe, expect, it } from "vitest";
import { cancelFocus, elapsedMin, endFocus, extendFocus, keepGoing, pauseFocus, remainingMs, resumeFocus, startFocus } from "./focus";
import { routine, state, task, TODAY } from "../test/fixtures";
import { cuesFor, tasksFor } from "./plan";

const at = (h: number, m = 0, s = 0) => new Date(2026, 10, 4, h, m, s);

describe("Start and focus", () => {
  it("starting inside a block runs to its planned end and records the real start", () => {
    const s = state({ tasks: [task({ id: "t", start: "09:00", dur: 90 })] });
    startFocus(s, s.tasks[0], at(9, 10));
    expect(s.focus).toMatchObject({ taskId: "t", mode: "block" });
    expect(remainingMs(s.focus!, at(9, 10)) / 60_000).toBe(80);
    expect(s.tasks[0].startedAt).toBe(at(9, 10).toISOString());
    expect(s.actuals.filter((a) => a.end === undefined)).toHaveLength(1); // running My day entry
  });

  it("starting outside its slot gives the block's full length", () => {
    const s = state({ tasks: [task({ start: "09:00", dur: 45 })] });
    startFocus(s, s.tasks[0], at(14, 0));
    expect(remainingMs(s.focus!, at(14, 0)) / 60_000).toBe(45);
  });

  it("works on routine blocks (turns the day's instance into a real task)", () => {
    const s = state({ routines: [routine({ days: [2] })] });
    startFocus(s, tasksFor(s, TODAY)[0], at(18, 0));
    expect(s.tasks).toHaveLength(1);
    expect(s.focus!.taskId).toBe(s.tasks[0].id);
  });

  it("just 5 minutes, then keep going through the block", () => {
    const s = state({ tasks: [task({ start: "09:00", dur: 60 })] });
    startFocus(s, s.tasks[0], at(9, 0), true);
    expect(remainingMs(s.focus!, at(9, 0)) / 60_000).toBe(5);
    keepGoing(s, at(9, 5));
    expect(s.focus!.mode).toBe("block");
    expect(remainingMs(s.focus!, at(9, 5)) / 60_000).toBe(55);
  });

  it("pauses don't count as time spent and push the end back", () => {
    const s = state({ tasks: [task({ start: "09:00", dur: 60 })] });
    startFocus(s, s.tasks[0], at(9, 0));
    pauseFocus(s, at(9, 20));
    expect(remainingMs(s.focus!, at(9, 50)) / 60_000).toBe(40); // frozen while paused
    resumeFocus(s, at(9, 30));
    expect(remainingMs(s.focus!, at(9, 30)) / 60_000).toBe(40);
    expect(elapsedMin(s.focus!, at(10, 10))).toBe(60);
  });

  it("+10 adds time and counts the extension on the block", () => {
    const s = state({ tasks: [task({ start: "09:00", dur: 60 })] });
    startFocus(s, s.tasks[0], at(9, 0));
    extendFocus(s, 10, at(10, 0));
    expect(remainingMs(s.focus!, at(10, 0)) / 60_000).toBe(10);
    expect(s.tasks[0].extendedMin).toBe(10);
  });

  it("done logs the real length from the real start, replacing the running entry", () => {
    const s = state({ tasks: [task({ start: "09:00", dur: 60 })] });
    startFocus(s, s.tasks[0], at(9, 15));
    endFocus(s, at(10, 25), "done");
    expect(s.focus).toBeUndefined();
    expect(s.tasks[0]).toMatchObject({ status: "done", actual: 70 });
    expect(s.actuals.map((a) => [a.start, a.end])).toEqual([[555, 625]]);
  });

  it("stopping early is 'partly done', not a failure", () => {
    const s = state({ tasks: [task({ start: "09:00", dur: 60 })] });
    startFocus(s, s.tasks[0], at(9, 0), true);
    endFocus(s, at(9, 5), "partial");
    expect(s.tasks[0]).toMatchObject({ status: "partial", share: 0.25 });
  });

  it("leaving focus without logging keeps the block open and closes the running entry", () => {
    const s = state({ tasks: [task({ start: "09:00", dur: 60 })] });
    startFocus(s, s.tasks[0], at(9, 0));
    cancelFocus(s, at(9, 12));
    expect(s.focus).toBeUndefined();
    expect(s.tasks[0].status).toBe("open");
    expect(s.actuals[0].end).toBe(552);
  });
});

describe("focus and notifications", () => {
  it("adds a 'time's up' prompt and quiets that block's own prompts and hourly WYD meanwhile", () => {
    const s = state({ tasks: [task({ id: "t", start: "09:00", dur: 90 }), task({ id: "u", start: "14:00", dur: 60 })] });
    startFocus(s, s.tasks[0], at(9, 0));
    const cues = cuesFor(s, TODAY);
    expect(cues.filter((c) => c.kind === "focus").map((c) => c.at)).toEqual([630]);
    expect(cues.some((c) => c.taskId === "t" && (c.kind === "mid" || c.kind === "end"))).toBe(false);
    expect(cues.some((c) => c.kind === "wyd" && c.at === 600)).toBe(false);
    expect(cues.some((c) => c.taskId === "u" && c.kind === "end")).toBe(true); // other blocks unaffected
  });
});
