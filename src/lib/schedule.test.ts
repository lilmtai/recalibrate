import { describe, expect, it } from "vitest";
import { applyRecovery, capacity, earliestFit, proposeLighten, proposeRecovery, recoveryTrigger, topTask, type RecoveryInput } from "./schedule";
import { tasksFor } from "./plan";
import { routine, state, task, TODAY } from "../test/fixtures";
import type { Task } from "../types";

const HOURS = { start: "07:00", end: "23:00" };
const min = (h: number, m = 0) => h * 60 + m;
const run = (tasks: Task[], now: number, extra: Partial<RecoveryInput> = {}) =>
  proposeRecovery({ date: TODAY, tasks, now, dayHours: HOURS, ...extra });
const byId = (p: ReturnType<typeof run>, id: string) => p.changes.find((c) => c.id === id);
/** every block's final [start, end) today after the proposal (for overlap checks) */
function finalDay(tasks: Task[], p: ReturnType<typeof run>) {
  return tasks.flatMap((t) => {
    const c = byId(p, t.id);
    // "nofit" stays where it is and is flagged for you, so it isn't part of the new plan
    if (c && (c.kind === "tray" || c.kind === "skip" || c.kind === "postpone" || c.kind === "nofit")) return [];
    const start = c?.to ? c.to.start : t.start;
    const dur = c?.to ? c.to.dur : t.dur;
    const [h, m] = start.split(":").map(Number);
    return [{ id: t.id, s: h * 60 + m, e: h * 60 + m + dur, fixed: t.fixed }];
  });
}
const noOverlap = (spans: { s: number; e: number }[]) =>
  spans.every((a, i) => spans.every((b, j) => i === j || a.e <= b.s || b.e <= a.s));

describe("earliestFit (gap-fit rule: never a 60-minute task in a 20-minute gap)", () => {
  const busy = [{ s: min(9), e: min(10) }, { s: min(10, 20), e: min(12) }];
  it("skips gaps that are too short", () => {
    expect(earliestFit(busy, min(9), min(23), 60)).toBe(min(12));
    expect(earliestFit(busy, min(9), min(23), 20)).toBe(min(10));
  });
  it("returns null when nothing fits before the end of the day", () => {
    expect(earliestFit(busy, min(22, 30), min(23), 60)).toBeNull();
  });
});

describe("proposeRecovery: the six scenarios", () => {
  it("late start: the block you didn't start moves to now and pushes the next one back", () => {
    const tasks = [
      task({ id: "a", title: "Write report", start: "09:00", dur: 60 }),
      task({ id: "b", title: "Emails", start: "10:00", dur: 30 }),
      task({ id: "c", title: "Lunch", start: "13:00", dur: 60 }),
    ];
    const p = run(tasks, min(9, 40));
    expect(byId(p, "a")?.to).toEqual({ start: "09:40", dur: 60 });
    expect(byId(p, "b")?.to).toEqual({ start: "10:40", dur: 30 });
    expect(byId(p, "c")).toBeUndefined(); // still fits: not moved
    expect(p.unchanged).toBe(1);
  });

  it("overrun: the running block keeps going and the next ones follow it", () => {
    const tasks = [
      task({ id: "a", start: "09:00", dur: 60, startedAt: "2026-11-04T09:00:00" }),
      task({ id: "b", start: "10:00", dur: 60 }),
    ];
    const p = run(tasks, min(10, 30));
    expect(byId(p, "a")).toBeUndefined(); // never moves the running block
    expect(byId(p, "b")?.to?.start).toBe("10:30");
  });

  it("missed gym: a block whose time passed goes to the next free slot; a routine that can't fit is skipped, not deleted", () => {
    const gym = task({ id: "g", title: "Gym", start: "07:00", dur: 60, category: "health" });
    const p = run([gym, task({ id: "w", start: "12:00", dur: 120 })], min(11));
    expect(byId(p, "g")?.to?.start).toBe("11:00"); // free until the 12:00 block
    const s = state({ routines: [routine({ start: "07:00" })] });
    const full = [...tasksFor(s, TODAY), task({ id: "x", start: "21:00", dur: 120, fixed: true })];
    const late = run(full, min(21));
    const r = late.changes.find((c) => c.title === "Gym");
    expect(r?.kind).toBe("skip");
  });

  it("low energy: hard work shrinks to its minimum version; low-priority hard work moves to another day", () => {
    const tasks = [
      task({ id: "deep", start: "14:00", dur: 120, energy: "high", minDur: 45 }),
      task({ id: "clean", start: "16:30", dur: 60, energy: "high", priority: "low" }),
      task({ id: "walk", start: "18:00", dur: 30, energy: "low" }),
    ];
    const p = run(tasks, min(13), { lowEnergy: true, later: [{ date: "2026-11-05", tasks: [] }] });
    expect(byId(p, "deep")).toMatchObject({ kind: "shorten", to: { start: "14:00", dur: 45 } });
    expect(byId(p, "clean")).toMatchObject({ kind: "postpone", to: { date: "2026-11-05", start: "16:30" } });
    expect(byId(p, "walk")).toBeUndefined();
  });

  it("new appointment: a fixed block that lands on flexible ones keeps its time; they move around it", () => {
    const tasks = [
      task({ id: "work", start: "14:00", dur: 90 }),
      task({ id: "doc", title: "Doctor", start: "14:30", dur: 60, fixed: true }),
      task({ id: "call", start: "15:30", dur: 30 }),
    ];
    const p = run(tasks, min(12));
    expect(byId(p, "doc")).toBeUndefined();
    expect(p.fixedKept).toBe(1);
    expect(byId(p, "work")?.to?.start).toBe("15:30");
    expect(byId(p, "call")?.to?.start).toBe("17:00");
    expect(noOverlap(finalDay(tasks, p))).toBe(true);
  });

  it("too much left: higher priority and nearer deadlines get the time; the rest shortens, postpones or waits", () => {
    const tasks = [
      task({ id: "low", start: "19:00", dur: 90, priority: "low" }),
      task({ id: "high", start: "20:00", dur: 90, priority: "high" }),
      task({ id: "due", start: "20:30", dur: 60, deadline: TODAY, minDur: 30 }),
      task({ id: "must", start: "21:00", dur: 60, noPostpone: true }),
      task({ id: "later", start: "21:30", dur: 60 }),
    ];
    const p = run(tasks, min(19), { later: [{ date: "2026-11-05", tasks: [] }] });
    expect(byId(p, "high")).toBeUndefined(); // keeps 20:00–21:30
    expect(byId(p, "due")?.kind).toBe("move"); // fits after it, full length
    expect(byId(p, "due")?.to?.start).toBe("21:30");
    expect(byId(p, "must")?.kind).toBe("nofit"); // has to happen today: flagged, not moved
    expect(byId(p, "later")?.kind).toBe("postpone");
    expect(byId(p, "low")?.kind).toBe("postpone");
    expect(noOverlap(finalDay(tasks, p))).toBe(true);
  });
});

describe("proposeRecovery: hard rules", () => {
  it("never proposes a block after its deadline: no later day → tray", () => {
    const p = run([task({ id: "a", start: "21:00", dur: 150, deadline: TODAY })], min(22), { later: [{ date: "2026-11-05", tasks: [] }] });
    expect(byId(p, "a")?.kind).toBe("tray");
  });
  it("doesn't touch finished blocks or fixed ones, and adds a 10-minute buffer after long hard work", () => {
    const tasks = [
      task({ id: "done", start: "09:00", dur: 60, status: "done" }),
      task({ id: "hard", start: "10:00", dur: 60, energy: "high" }),
      task({ id: "next", start: "11:00", dur: 30 }),
    ];
    const p = run(tasks, min(8));
    expect(byId(p, "done")).toBeUndefined();
    expect(byId(p, "next")?.to?.start).toBe("11:10");
  });
  it("keeps blocks inside the day hours unless you placed them outside", () => {
    const p = run([task({ id: "a", start: "23:15", dur: 30 }), task({ id: "b", start: "22:00", dur: 60 })], min(22, 30));
    expect(byId(p, "a")).toBeUndefined(); // you put it there
    expect(byId(p, "b")?.kind).toBe("tray"); // can't fit inside 07:00–23:00 any more
  });
  it("a future day uses the whole day window and changes nothing that fits", () => {
    const p = run([task({ id: "a", start: "09:00" }), task({ id: "b", start: "09:30", dur: 30 })], -1);
    expect(byId(p, "a")).toBeUndefined();
    expect(byId(p, "b")?.to?.start).toBe("10:30"); // overlap resolved (rule 5)
  });
});

describe("minimum viable day", () => {
  it("keeps fixed, essential and the single top-priority task; the rest becomes optional", () => {
    const s = state({ routines: [routine({ id: "meds", title: "Meds", start: "20:00", dur: 15, days: [2], essential: true }), routine({ id: "gym", title: "Gym", start: "18:00", days: [2] })] });
    const tasks = [
      ...tasksFor(s, TODAY),
      task({ id: "pitch", title: "Pitch deck", start: "14:00", dur: 60, priority: "high" }),
      task({ id: "admin", title: "Admin", start: "15:00", dur: 30 }),
      task({ id: "dentist", start: "16:00", dur: 30, fixed: true }),
    ];
    expect(topTask(tasks)?.id).toBe("pitch");
    const p = run(tasks, min(12), { mode: "minimum" });
    expect(byId(p, "pitch")).toBeUndefined();
    expect(byId(p, "dentist")).toBeUndefined();
    expect(p.changes.find((c) => c.title === "Meds")).toBeUndefined();
    expect(byId(p, "admin")?.kind).toBe("tray");
    expect(p.changes.find((c) => c.title === "Gym")?.kind).toBe("skip");
  });
});

describe("applyRecovery", () => {
  it("applies only approved changes and records each in the block's history", () => {
    const s = state({
      tasks: [task({ id: "a", start: "09:00", dur: 60 }), task({ id: "b", start: "10:00", dur: 30 }), task({ id: "c", start: "21:00", dur: 60 })],
      routines: [routine({ start: "07:00", days: [2] })],
    });
    const tasks = tasksFor(s, TODAY);
    const p = run(tasks, min(9, 40), { later: [{ date: "2026-11-05", tasks: [] }] });
    const approved = p.changes.filter((c) => c.id !== "b");
    const draft = structuredClone(s);
    const n = applyRecovery(draft, TODAY, tasks, approved, new Date(2026, 10, 4, 9, 40));
    expect(n).toBe(approved.length);
    const a = draft.tasks.find((t) => t.id === "a")!;
    expect(a.start).toBe("09:40");
    expect(a.moves).toEqual([{ at: new Date(2026, 10, 4, 9, 40).toISOString(), from: "09:00", to: "09:40", source: "recovery" }]);
    expect(draft.tasks.find((t) => t.id === "b")!.start).toBe("10:00"); // not approved: untouched
    // the routine instance was materialized and moved, the routine itself is unchanged
    expect(draft.routines[0].start).toBe("07:00");
  });
  it("postpone moves the block to the other day and remembers where it came from", () => {
    const s = state({ tasks: [task({ id: "a", start: "22:00", dur: 120 })] });
    const draft = structuredClone(s);
    applyRecovery(draft, TODAY, tasksFor(s, TODAY), [{ id: "a", title: "x", kind: "postpone", from: { start: "22:00", dur: 120 }, to: { start: "09:00", dur: 120, date: "2026-11-05" }, reason: "" }]);
    expect(draft.tasks[0]).toMatchObject({ date: "2026-11-05", start: "09:00" });
    expect(draft.tasks[0].moves?.[0]).toMatchObject({ from: "22:00", to: "09:00", toDate: "2026-11-05", source: "recovery" });
  });
});

describe("recoveryTrigger (only offers, never applies)", () => {
  it("offers after a 30+ minute overrun, two slipped blocks, or a low-energy check-in", () => {
    const running = task({ id: "a", start: "09:00", dur: 60, startedAt: "x" });
    expect(recoveryTrigger([running], min(10, 20))).toBeNull();
    expect(recoveryTrigger([running], min(10, 30))).toMatch(/ran over by 30/);
    expect(recoveryTrigger([task({ start: "08:00", dur: 30 }), task({ start: "09:00", dur: 30 })], min(10))).toMatch(/2 blocks/);
    expect(recoveryTrigger([task({ start: "14:00", energy: "high" })], min(10), { lowEnergy: true })).toMatch(/Low energy/);
    expect(recoveryTrigger([task({ start: "14:00" })], min(10))).toBeNull();
  });
});

describe("capacity (P-3)", () => {
  const cap = (tasks: Task[], now: number, multiplier?: number) => capacity({ tasks, now, dayHours: HOURS, multiplier });
  it("a future day: the whole window, minus fixed appointments, minus a 15% buffer", () => {
    const c = cap([task({ start: "09:00", dur: 120 }), task({ start: "14:00", dur: 60, fixed: true })], -1);
    expect(c.window).toBe(960); // 07:00–23:00
    expect(c.fixed).toBe(60);
    expect(c.available).toBe(900);
    expect(c.buffer).toBe(144);
    expect(c.planned).toBe(120);
    expect(c.free).toBe(900 - 144 - 120);
    expect(c.over).toBe(0);
  });
  it("today: time already passed is gone, finished blocks don't count, a running block counts what's left", () => {
    const c = cap([
      task({ id: "done", start: "08:00", dur: 60, status: "done" }),
      task({ id: "run", start: "17:30", dur: 60, startedAt: "x" }),
      task({ id: "later", start: "20:00", dur: 60 }),
      task({ id: "fx", start: "17:00", dur: 60, fixed: true }), // half of it is past
    ], min(18));
    expect(c.window).toBe(300);
    expect(c.fixed).toBe(0);
    expect(c.planned).toBe(30 + 60);
    expect(c.buffer).toBe(45);
  });
  it("a missed block still counts (it still needs doing); long hard work adds 10 min of buffer", () => {
    const c = cap([task({ start: "08:00", dur: 30 }), task({ start: "19:00", dur: 90, energy: "high" })], min(18));
    expect(c.planned).toBe(120);
    expect(c.buffer).toBe(45 + 10);
  });
  it("overload when planned is more than available − buffer; realistic uses the time multiplier", () => {
    const c = cap([task({ start: "19:00", dur: 180 }), task({ start: "22:00", dur: 60 })], min(19), 1.25);
    expect(c.window).toBe(240);
    expect(c.buffer).toBe(36);
    expect(c.over).toBe(240 - (240 - 36));
    expect(c.realistic).toBe(300);
    expect(c.free).toBeLessThan(0);
  });
});

describe("proposeLighten (P-4 overload fixes)", () => {
  const base = { date: TODAY, now: min(16), dayHours: HOURS, later: [{ date: "2026-11-05", tasks: [] as Task[] }] };
  // 16:00–23:00 = 420 min, minus the 60-min dentist = 360, minus a 63-min buffer = 297 of room; 420 planned → 123 over
  const day = () => [
    task({ id: "deep", start: "16:00", dur: 120, minDur: 60, priority: "high" }),
    task({ id: "admin", start: "18:00", dur: 90, minDur: 30, priority: "low" }),
    task({ id: "gym", start: "19:30", dur: 60, minDur: 30 }),
    task({ id: "call", start: "20:30", dur: 30, noPostpone: true }),
    task({ id: "meal", start: "21:00", dur: 60, essential: true }),
    task({ id: "read", start: "22:00", dur: 60, priority: "low" }),
    task({ id: "dent", start: "17:00", dur: 60, fixed: true }),
  ];
  it("shorten: minimum versions, least important first, only until it fits", () => {
    const tasks = day();
    expect(capacity({ ...base, tasks }).over).toBe(123);
    const p = proposeLighten({ ...base, tasks }, "shorten");
    expect(p.changes.map((c) => c.id)).toEqual(["admin", "gym", "deep"]);
    expect(p.changes[0]).toMatchObject({ kind: "shorten", to: { start: "18:00", dur: 30 } });
    expect(p.over).toBe(0);
  });
  it("postpone: low priority first, to the next free slot; never essential, must-today, high priority or fixed", () => {
    const p = proposeLighten({ ...base, tasks: day() }, "postpone");
    const ids = p.changes.map((c) => c.id);
    expect(ids.slice(0, 2)).toEqual(["read", "admin"]);
    for (const no of ["call", "meal", "deep", "dent"]) expect(ids).not.toContain(no);
    expect(p.changes[0]).toMatchObject({ kind: "postpone", to: { date: "2026-11-05", start: "22:00" } });
  });
  it("says how much is still over when the allowed changes aren't enough; routines are skipped, not moved", () => {
    const s = state({ routines: [routine({ start: "18:00", dur: 300, days: [2] })] });
    const tasks = [...tasksFor(s, TODAY), task({ id: "x", start: "16:00", dur: 400, noPostpone: true })];
    const p = proposeLighten({ ...base, tasks }, "postpone");
    expect(p.changes).toHaveLength(1);
    expect(p.changes[0].kind).toBe("skip");
    expect(p.over).toBeGreaterThan(0);
  });
  it("nothing to do when the day fits", () => {
    const p = proposeLighten({ ...base, tasks: [task({ start: "17:00", dur: 60 })] }, "shorten");
    expect(p.changes).toEqual([]);
    expect(p.over).toBe(0);
  });
});
