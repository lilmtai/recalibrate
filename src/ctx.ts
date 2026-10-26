import { createContext, useContext } from "react";
import type { Routine, Rule, State, Task } from "./types";

export type SheetState =
  | { type: "block"; date: string; task?: Task; start?: string }
  | { type: "routine"; routine?: Routine }
  | { type: "log"; task: Task }
  | { type: "actual"; taskId: string; planned: number }
  | { type: "miss"; task: Task }
  | { type: "rule"; rule: Rule }
  | { type: "account" }
  | null;

export type Tab = "day" | "week" | "routines" | "playbook" | "patterns";

export interface AppCtx {
  state: State;
  update: (fn: (draft: State) => void) => void;
  date: string;
  setDate: (d: string) => void;
  setTab: (t: Tab) => void;
  open: (s: SheetState) => void;
  close: () => void;
  toast: (msg: string) => void;
  now: number; // minutes after midnight, ticks every 30 s
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
