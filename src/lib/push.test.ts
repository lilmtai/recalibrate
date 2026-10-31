import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildQueue } from "./push";
import { NOW, routine, state } from "../test/fixtures";

describe("notification schedule", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => vi.useRealTimers());

  const s = state({ routines: [routine({ days: [0, 1, 2, 3, 4, 5, 6] })], notify: { enabled: true, start: true, mid: true, end: true, fix: true, free: true, wyd: true } });

  it("only schedules the future, with unique tags", () => {
    const q = buildQueue(s);
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((i) => Date.parse(i.send_at) > NOW.getTime())).toBe(true);
    expect(new Set(q.map((i) => i.tag)).size).toBe(q.length);
  });
  it("respects each switch, and pausing stops everything", () => {
    expect(buildQueue({ ...s, notify: { ...s.notify!, wyd: false } }).some((i) => i.kind === "wyd")).toBe(false);
    expect(buildQueue({ ...s, notify: { ...s.notify!, enabled: false } })).toEqual([]);
  });
  it("links each prompt to the right screen", () => {
    const q = buildQueue(s);
    expect(q.find((i) => i.kind === "wyd")!.url).toMatch(/^\.\/\?wyd=1&date=/);
    expect(q.find((i) => i.kind === "end")!.url).toContain("task=rt%3Ar1%3A");
  });
});
