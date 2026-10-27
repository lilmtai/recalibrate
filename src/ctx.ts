import { createContext, useContext } from "react";
import type { Actual, Routine, Rule, State, Task } from "./types";

export type SheetState =
  | { type: "block"; date: string; task?: Task; start?: string; title?: string; fromNote?: string }
  | { type: "routine"; routine?: Routine }
  | { type: "log"; task: Task }
  | { type: "actual"; taskId: string; planned: number }
  | { type: "miss"; task: Task; partial?: boolean }
  | { type: "check"; task: Task }
  | { type: "note"; noteId: string }
  | { type: "rule"; rule: Rule }
  | { type: "account" }
  | { type: "setup" }
  | { type: "entry"; date: string; entry?: Actual; start?: number; end?: number }
  | null;

export type ToastAction = { label: string; run: () => void };

export type Tab = "day" | "myday" | "week" | "routines" | "playbook" | "patterns";

export interface AppCtx {
  state: State;
  update: (fn: (draft: State) => void) => void;
  date: string;
  setDate: (d: string) => void;
  setTab: (t: Tab) => void;
  open: (s: SheetState) => void;
  close: () => void;
  toast: (msg: string, action?: ToastAction) => void;
  now: number; // minutes after midnight, ticks every 30 s
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
