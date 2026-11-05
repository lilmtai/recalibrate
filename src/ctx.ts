import { createContext, useContext } from "react";
import type { Actual, BarrierKey, FreeItem, Page, Project, Routine, Rule, State, Task } from "./types";

export type SheetState =
  | { type: "block"; date: string; task?: Task; start?: string; title?: string; fromNote?: string }
  | { type: "routine"; routine?: Routine }
  | { type: "log"; task: Task }
  | { type: "actual"; taskId: string; planned: number }
  | { type: "miss"; task: Task; partial?: boolean; barrier?: BarrierKey }
  | { type: "check"; task: Task }
  | { type: "ask"; task: Task; kind: string }
  | { type: "why"; task: Task }
  | { type: "free"; item?: FreeItem }
  | { type: "freedue"; id: string }
  | { type: "wyd"; date: string; at?: number; from?: number; promptKey?: string }
  | { type: "review" }
  | { type: "voice"; date: string }
  | { type: "assistant" }
  | { type: "recover"; date: string; mode?: "fix" | "minimum" | "shorten" | "postpone" }
  | { type: "capacity"; date: string }
  | { type: "categories" }
  | { type: "project"; project?: Project }
  | { type: "page"; page?: Page; projectId: string; kind: Page["kind"] }
  | { type: "note"; noteId: string }
  | { type: "rule"; rule: Rule }
  | { type: "account" }
  | { type: "setup" }
  | { type: "quick" }
  | { type: "welcome" }
  | { type: "entry"; date: string; entry?: Actual; start?: number; end?: number }
  | null;

export type ToastAction = { label: string; run: () => void };

/** Screens. Bottom tabs group them: Today = day + myday, Insights = patterns + playbook. */
export type Tab = "day" | "myday" | "work" | "week" | "patterns" | "playbook" | "me" | "history";

export interface AppCtx {
  state: State;
  update: (fn: (draft: State) => void) => void;
  date: string;
  setDate: (d: string) => void;
  setTab: (t: Tab) => void;
  open: (s: SheetState) => void;
  close: () => void;
  /** go back to the panel that opened this one */
  back: () => void;
  canBack: boolean;
  toast: (msg: string, action?: ToastAction) => void;
  now: number; // minutes after midnight, ticks every 30 s
  /** gold check moment + a light vibration when something gets done */
  celebrate: () => void;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
