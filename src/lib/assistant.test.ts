import { describe, expect, it } from "vitest";
import { applySuggestion, buildAssistantContext, checkSuggestions } from "./assistant";
import { tasksFor } from "./plan";
import { routine, state, task, TODAY } from "../test/fixtures";

const min = (h: number, m = 0) => h * 60 + m;
const day = () => state({
  tasks: [
    task({ id: "deep", title: "Deep work", start: "09:00", dur: 120 }),
    task({ id: "dent", title: "Dentist", start: "14:00", dur: 60, fixed: true }),
    task({ id: "done", title: "Emails", start: "08:00", dur: 30, status: "done" }),
  ],
  routines: [routine({ id: "gym", title: "Gym", start: "18:00", dur: 60, days: [2] })],
  projects: [{ id: "p1", name: "Content", area: "side", status: "active", created: TODAY, why: "Grow the audience" }],
  steps: [
    { id: "s1", projectId: "p1", text: "Outline 3 posts", done: false, order: 1 },
    { id: "s2", projectId: "p1", text: "Film intro", done: false, order: 2 },
  ],
  pages: [{ id: "g1", projectId: "journal", kind: "goal", title: "1k followers", text: "", created: TODAY, target: "2026-12-31" }],
});

describe("buildAssistantContext", () => {
  it("sends 7 days of blocks with free slots computed by the app (from now, inside day hours)", () => {
    const c = buildAssistantContext(day(), TODAY, min(10, 7));
    expect(c.days).toHaveLength(7);
    expect(c.now).toMatchObject({ date: TODAY, time: "10:07" });
    const today = c.days[0];
    expect(today.blocks.map((b) => b.title)).toEqual(["Emails", "Deep work", "Dentist", "Gym"]);
    expect(today.blocks.find((b) => b.title === "Dentist")).toMatchObject({ fixed: true, start: "14:00", end: "15:00" });
    expect(today.freeSlots).toEqual([
      { from: "11:00", to: "14:00", minutes: 180 },
      { from: "15:00", to: "18:00", minutes: 180 },
      { from: "19:00", to: "23:00", minutes: 240 },
    ]);
    expect(c.days[1].freeSlots[0]).toMatchObject({ from: "07:00" });
  });
  it("includes projects with their next step, goals and to-dos", () => {
    const c = buildAssistantContext(day(), TODAY, min(10));
    expect(c.projects[0]).toMatchObject({ name: "Content", nextStep: "Outline 3 posts", openSteps: ["Outline 3 posts", "Film intro"] });
    expect(c.goals).toEqual([{ goal: "1k followers", target: "2026-12-31" }]);
  });
});

describe("checkSuggestions (the app checks every suggestion before you see it)", () => {
  const s = day();
  const sug = (p: Record<string, unknown>) => ({ type: "add", block_id: null, date: TODAY, title: "Tutor", start: "11:00", minutes: 60, category: "learning", why: "free", ...p });
  it("keeps a suggestion that fits a free slot", () => {
    const r = checkSuggestions([sug({})], s, TODAY, min(10));
    expect(r.ok).toEqual([{ kind: "add", key: "a0", date: TODAY, title: "Tutor", start: 660, dur: 60, category: "learning", why: "free" }]);
    expect(r.dropped).toBe(0);
  });
  it("drops overlaps, the past, other weeks, bad times and unknown categories fall back", () => {
    const r = checkSuggestions([
      sug({ start: "13:30" }), // overlaps the dentist
      sug({ start: "09:30" }), // past + overlaps deep work
      sug({ date: "2026-12-01" }), // too far ahead
      sug({ start: "25:00" }),
      sug({ minutes: 2 }),
      sug({ start: "15:00", category: "made-up" }),
    ], s, TODAY, min(10));
    expect(r.dropped).toBe(5);
    expect(r.ok).toEqual([expect.objectContaining({ start: 900, category: "me" })]);
  });
  it("suggestions are checked together: two can't take the same slot", () => {
    const r = checkSuggestions([sug({}), sug({ title: "Gym", start: "11:30" })], s, TODAY, min(10));
    expect(r.ok.map((x) => x.title)).toEqual(["Tutor"]);
    expect(r.dropped).toBe(1);
  });
  it("can move a flexible block (even a routine instance) but never a fixed or logged one", () => {
    const r = checkSuggestions([
      { type: "move", block_id: "dent", date: TODAY, title: "Dentist", start: "16:00", minutes: 60, category: null, why: "" },
      { type: "move", block_id: "done", date: TODAY, title: "Emails", start: "16:00", minutes: 30, category: null, why: "" },
      { type: "move", block_id: `rt:gym:${TODAY}`, date: TODAY, title: "Gym", start: "16:00", minutes: 60, category: null, why: "earlier" },
      { type: "add", block_id: null, date: TODAY, title: "Tutor", start: "18:00", minutes: 60, category: "learning", why: "where gym was" },
    ], s, TODAY, min(10));
    expect(r.dropped).toBe(2);
    expect(r.ok.map((x) => x.kind + ":" + x.title)).toEqual(["move:Gym", "add:Tutor"]);
  });
});

describe("applySuggestion (only when tapped)", () => {
  it("adds a block, or moves one and records it in its history as an AI suggestion", () => {
    const s = day();
    const { ok } = checkSuggestions([
      { type: "move", block_id: `rt:gym:${TODAY}`, date: TODAY, title: "Gym", start: "16:00", minutes: 60, category: null, why: "" },
      { type: "add", block_id: null, date: TODAY, title: "Tutor", start: "18:00", minutes: 60, category: "learning", why: "" },
    ], s, TODAY, min(10));
    const draft = structuredClone(s);
    expect(applySuggestion(draft, ok[0], new Date(2026, 10, 4, 10))).toBe(true);
    expect(applySuggestion(draft, ok[1])).toBe(true);
    const t = tasksFor(draft, TODAY);
    expect(t.find((x) => x.title === "Gym")).toMatchObject({ start: "16:00", moves: [expect.objectContaining({ from: "18:00", to: "16:00", source: "ai" })] });
    expect(t.find((x) => x.title === "Tutor")).toMatchObject({ start: "18:00", dur: 60, category: "learning", status: "open" });
    expect(draft.routines[0].start).toBe("18:00"); // the routine itself is untouched
  });
  it("refuses if the schedule changed and it no longer fits", () => {
    const s = day();
    const { ok } = checkSuggestions([{ type: "add", block_id: null, date: TODAY, title: "Tutor", start: "11:00", minutes: 60, category: null, why: "" }], s, TODAY, min(10));
    const draft = structuredClone(s);
    draft.tasks.push(task({ id: "new", start: "11:30", dur: 30 }));
    expect(applySuggestion(draft, ok[0])).toBe(false);
  });
});
