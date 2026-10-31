import { describe, expect, it } from "vitest";
import { merge } from "./sync";
import { state, task } from "./test/fixtures";

describe("sync merge", () => {
  it("keeps items from both devices and lets the newer copy win", () => {
    const phone = state({ tasks: [task({ id: "a", title: "Old" }), task({ id: "p" })], updatedAt: 1 });
    const laptop = state({ tasks: [task({ id: "a", title: "New" }), task({ id: "l" })], updatedAt: 2 });
    const m = merge(phone, laptop);
    expect(m.tasks.map((t) => t.id).sort()).toEqual(["a", "l", "p"]);
    expect(m.tasks.find((t) => t.id === "a")!.title).toBe("New");
  });
  it("merges every list, including Work data", () => {
    const a = state({ projects: [{ id: "x", name: "A", area: "work", status: "active", created: "2026-11-01" }], updatedAt: 1 });
    const b = state({ pages: [{ id: "y", projectId: "journal", kind: "journal", text: "hi", created: "2026-11-01" }], updatedAt: 2 });
    const m = merge(a, b);
    expect(m.projects).toHaveLength(1);
    expect(m.pages).toHaveLength(1);
  });
});
