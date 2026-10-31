import type { Project, State, Step } from "../types";

export const JOURNAL = "journal";

export const stepsOf = (s: State, projectId: string) =>
  s.steps.filter((x) => x.projectId === projectId).sort((a, b) => a.order - b.order);

/** The pinned step, or the first open one. */
export function nextStep(s: State, projectId: string): Step | undefined {
  const open = stepsOf(s, projectId).filter((x) => !x.done);
  return open.find((x) => x.next) || open[0];
}

export const activeProjects = (s: State): Project[] => s.projects.filter((p) => p.status === "active");

export const pagesOf = (s: State, projectId: string, kind?: string) =>
  s.pages.filter((p) => p.projectId === projectId && (!kind || p.kind === kind))
    .sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));

export const nowIso = () => new Date().toISOString();
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
