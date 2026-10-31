import { describe, expect, it } from "vitest";
import { freeGaps, layoutLanes, lenLabel } from "./dayLayout";

describe("layoutLanes", () => {
  it("keeps separate blocks full width", () => {
    const l = layoutLanes([{ id: "a", start: 540, dur: 60 }, { id: "b", start: 600, dur: 30 }]);
    expect(l).toEqual({ a: { lane: 0, of: 1 }, b: { lane: 0, of: 1 } });
  });
  it("puts overlapping blocks side by side, only within their group", () => {
    const l = layoutLanes([
      { id: "a", start: 540, dur: 60 },
      { id: "b", start: 570, dur: 60 },
      { id: "c", start: 720, dur: 30 },
    ]);
    expect(l.a).toEqual({ lane: 0, of: 2 });
    expect(l.b).toEqual({ lane: 1, of: 2 });
    expect(l.c).toEqual({ lane: 0, of: 1 });
  });
  it("treats short blocks as their drawn length so they don't cover each other", () => {
    const spans = [{ id: "a", start: 540, dur: 15 }, { id: "b", start: 555, dur: 15 }];
    expect(layoutLanes(spans).b.of).toBe(1);
    expect(layoutLanes(spans, 25).b).toEqual({ lane: 1, of: 2 });
  });
});

describe("freeGaps", () => {
  it("finds free time of 30 minutes or more", () => {
    const gaps = freeGaps([{ id: "a", start: 540, dur: 60 }, { id: "b", start: 620, dur: 40 }, { id: "c", start: 720, dur: 60 }], 480, 840);
    expect(gaps).toEqual([{ from: 480, to: 540 }, { from: 660, to: 720 }, { from: 780, to: 840 }]);
  });
  it("handles overlapping blocks and an empty day", () => {
    expect(freeGaps([{ id: "a", start: 540, dur: 120 }, { id: "b", start: 560, dur: 20 }], 540, 680)).toEqual([]);
    expect(freeGaps([], 420, 1380)).toEqual([{ from: 420, to: 1380 }]);
  });
});

it("lenLabel", () => {
  expect([lenLabel(30), lenLabel(60), lenLabel(90)]).toEqual(["30m", "1h", "1h 30m"]);
});
