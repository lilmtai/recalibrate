import { describe, expect, it } from "vitest";
import { applyVoice, buildVoiceRequest, parseVoiceResult } from "./voice";
import { tasksFor } from "./plan";
import { routine, state, task, TODAY } from "../test/fixtures";

const day = () => state({
  tasks: [
    task({ id: "spanish", title: "Spanish", start: "18:00", dur: 60, category: "learning" }),
    task({ id: "done1", title: "Emails", start: "09:00", dur: 30, status: "done" }),
  ],
  routines: [routine({ id: "gym", title: "Gym", start: "07:00", dur: 60, days: [2] })],
});

describe("buildVoiceRequest", () => {
  it("sends the day's plan (routine instances included), the lists and the time", () => {
    const s = day();
    const body = buildVoiceRequest(s, TODAY, "  gym was good  ", 20 * 60);
    expect(body.text).toBe("gym was good");
    expect(body.now).toBe("20:00");
    expect(body.plan.map((p) => p.title)).toEqual(["Gym", "Emails", "Spanish"]);
    expect(body.plan[0]).toMatchObject({ id: `rt:gym:${TODAY}`, start: "07:00", end: "08:00", status: "open" });
    expect(body.barriers.length).toBeGreaterThan(5);
    expect(body.instead.length).toBeGreaterThan(5);
  });
});

describe("parseVoiceResult (never trust, always check)", () => {
  const s = day();
  const gymId = `rt:gym:${TODAY}`;
  const raw = {
    blocks: [
      { id: gymId, status: "done", minutes: 45, reason: null, note: null },
      { id: "spanish", status: "missed", minutes: null, reason: "energy", note: "too tired" },
      { id: "done1", status: "missed", minutes: null, reason: null, note: null }, // already logged
      { id: "made-up", status: "done", minutes: null, reason: null, note: null }, // not in the plan
      { id: "spanish", status: "done", minutes: null, reason: null, note: null }, // duplicate
    ],
    extra: [
      { title: "Phone", start: "18:00", end: "19:00", category: null, instead: "phone" },
      { title: "Dinner", start: "20:00", end: null, category: "cooking", instead: null },
      { title: "Nap", start: null, end: null, category: null, instead: null },
      { title: "Walk", start: "25:99", end: "26:00", category: "nope", instead: "nope" },
    ],
    energy: "low", sleep: 6.3, todos: ["Call the bank", ""], summary: "A tired day with a solid gym session.",
  };
  const p = parseVoiceResult(raw, s, TODAY);

  it("keeps only real, still-open blocks, once each", () => {
    const blocks = p.items.filter((i) => i.kind === "block");
    expect(blocks).toEqual([
      { kind: "block", id: `b:${gymId}`, taskId: gymId, title: "Gym", status: "done", minutes: 45 },
      { kind: "block", id: "b:spanish", taskId: "spanish", title: "Spanish", status: "missed", reason: "energy", note: "too tired" },
    ]);
    expect(p.skipped).toContain("Emails (already logged)");
  });
  it("never drops an entry for a missing time: it's estimated in the order told and marked; unknown keys are dropped", () => {
    const extras = p.items.filter((i) => i.kind === "extra");
    expect(extras).toEqual([
      { kind: "extra", id: "e:0", title: "Phone", start: 1080, end: 1140, guessedEnd: false, instead: "phone" },
      { kind: "extra", id: "e:1", title: "Dinner", start: 1200, end: 1230, guessedEnd: true, category: "cooking" },
      { kind: "extra", id: "e:2", title: "Nap", start: 1230, end: 1260, guessedEnd: true },
      { kind: "extra", id: "e:3", title: "Walk", start: 1260, end: 1290, guessedEnd: true },
    ]);
    expect(p.skipped).toEqual(["Emails (already logged)"]);
  });
  it("untimed entries told before any time work back from now (the owner's breakfast example)", () => {
    const q = parseVoiceResult({ blocks: [], extra: [
      { title: "Went home, made breakfast for my wife and me", start: null, end: null, category: null, instead: null },
      { title: "Back to the coffee shop to continue work", start: null, end: null, category: "work", instead: null },
    ], energy: null, sleep: null, todos: [], summary: "" }, s, TODAY, 11 * 60);
    const ex = q.items.filter((i) => i.kind === "extra");
    expect(ex.map((i) => i.kind === "extra" && [i.start, i.end, i.guessedEnd])).toEqual([[600, 630, true], [630, 660, true]]);
    expect(q.skipped).toEqual([]);
  });
  it("energy, sleep (to the half hour), to-dos and the summary", () => {
    expect(p.items.find((i) => i.kind === "energy")).toMatchObject({ energy: "low" });
    expect(p.items.find((i) => i.kind === "sleep")).toMatchObject({ hours: 6.5 });
    expect(p.items.filter((i) => i.kind === "todo").map((i) => i.kind === "todo" && i.text)).toEqual(["Call the bank"]);
    expect(p.summary).toMatch(/gym/);
  });
  it("survives garbage", () => {
    expect(parseVoiceResult(null, s, TODAY)).toEqual({ items: [], summary: "", skipped: [] });
    expect(parseVoiceResult({ blocks: "x", extra: [1, null], todos: {} }, s, TODAY).items).toEqual([]);
  });
});

describe("applyVoice (only what was approved)", () => {
  it("logs blocks like the log panel does, adds entries, check-in and to-dos", () => {
    const s = day();
    const p = parseVoiceResult({
      blocks: [
        { id: `rt:gym:${TODAY}`, status: "done", minutes: 45, reason: null, note: null },
        { id: "spanish", status: "partial", minutes: 30, reason: "energy", note: null },
      ],
      extra: [{ title: "Phone", start: "21:00", end: "21:30", category: null, instead: "phone" }],
      energy: "steady", sleep: 7, todos: ["Buy milk"], summary: "",
    }, s, TODAY);
    const draft = structuredClone(s);
    // the user unticked the to-do
    const n = applyVoice(draft, TODAY, p.items.filter((i) => i.kind !== "todo"), new Date(2026, 10, 4, 22));
    expect(n).toBe(5);
    const gym = draft.tasks.find((t) => t.routineId === "gym")!;
    expect(gym).toMatchObject({ status: "done", actual: 45 });
    expect(draft.routines[0].start).toBe("07:00"); // routine untouched
    expect(draft.tasks.find((t) => t.id === "spanish")).toMatchObject({ status: "partial", share: 0.5, barrier: "energy" });
    expect(draft.actuals.some((a) => a.title === "Phone" && a.kind === "instead" && a.start === 1260)).toBe(true);
    expect(draft.actuals.some((a) => a.taskId === gym.id && a.end! - a.start === 45)).toBe(true);
    expect(draft.checkins[TODAY]).toMatchObject({ energy: "steady", sleep: 7 });
    expect(draft.notes).toEqual([]);
  });
  it("never overwrites a block that got logged in the meantime", () => {
    const s = day();
    const p = parseVoiceResult({ blocks: [{ id: "spanish", status: "missed", minutes: null, reason: null, note: null }], extra: [], energy: null, sleep: null, todos: [], summary: "" }, s, TODAY);
    const draft = structuredClone(s);
    draft.tasks.find((t) => t.id === "spanish")!.status = "done";
    expect(applyVoice(draft, TODAY, p.items)).toBe(0);
    expect(tasksFor(draft, TODAY).find((t) => t.id === "spanish")!.status).toBe("done");
  });
});
