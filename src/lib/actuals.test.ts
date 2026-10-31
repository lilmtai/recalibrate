import { describe, expect, it } from "vitest";
import { logSame, logSpan, syncActuals, wydFrom } from "./actuals";
import { state, task, TODAY } from "../test/fixtures";

describe("My day log from block outcomes", () => {
  it("done logs the block for its real length", () => {
    const s = state();
    const t = task({ status: "done", actual: 120 });
    syncActuals(s, t);
    expect(s.actuals).toHaveLength(1);
    expect(s.actuals[0]).toMatchObject({ start: 540, end: 660, kind: "plan", taskId: t.id });
  });
  it("partly done logs the done part plus what took the rest", () => {
    const s = state();
    syncActuals(s, task({ status: "partial", share: 0.5, instead: { what: ["phone"] } }));
    expect(s.actuals.map((a) => [a.kind, a.start, a.end])).toEqual([["plan", 540, 585], ["instead", 585, 630]]);
  });
  it("re-logging replaces the automatic entries instead of duplicating", () => {
    const s = state();
    const t = task({ status: "done" });
    syncActuals(s, t);
    syncActuals(s, { ...t, status: "missed", instead: { what: ["rest"] } });
    expect(s.actuals).toHaveLength(1);
    expect(s.actuals[0].kind).toBe("instead");
  });
});

describe("hourly WYD logging", () => {
  it("starts after the last entry, never more than an hour back", () => {
    const s = state();
    expect(wydFrom(s, TODAY, 600)).toBe(540);
    logSpan(s, TODAY, 540, 570, { title: "Email", kind: "free" });
    expect(wydFrom(s, TODAY, 600)).toBe(570);
  });
  it("'same as before' stretches a recent entry, or repeats an older one for the last hour", () => {
    const s = state();
    logSpan(s, TODAY, 540, 600, { title: "Coding", kind: "free" });
    expect(logSame(s, TODAY, 660)).toBe("Coding");
    expect(s.actuals).toHaveLength(1);
    expect(s.actuals[0].end).toBe(660);
    expect(logSame(s, TODAY, 900)).toBe("Coding"); // 4h later: a new entry for the last hour
    expect(s.actuals).toHaveLength(2);
    expect(s.actuals[1]).toMatchObject({ start: 840, end: 900 });
  });
  it("'same as before' with nothing logged does nothing", () => {
    expect(logSame(state(), TODAY, 600)).toBeNull();
  });
});
