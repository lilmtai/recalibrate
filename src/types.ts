export type Energy = "low" | "med" | "high";
export type CategoryKey = "work" | "health" | "social" | "side" | "me";
export type BarrierKey =
  | "energy" | "bloated" | "overwhelm" | "time" | "forgot" | "avoid" | "sleep" | "cameup";
/** done = full block, ifnot = did the "if not" fallback, skipped = removed for that day */
export type Status = "open" | "done" | "ifnot" | "missed" | "skipped";

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  start: string; // HH:MM
  dur: number; // minutes
  category: CategoryKey;
  energy?: Energy;
  ifNot?: string;
  status: Status;
  actual?: number;
  barrier?: BarrierKey;
  note?: string;
  routineId?: string;
  ex?: boolean;
}

/** A sticky block: repeats on the chosen weekdays (0 = Monday … 6 = Sunday). */
export interface Routine {
  id: string;
  title: string;
  start: string;
  dur: number;
  category: CategoryKey;
  energy?: Energy;
  ifNot?: string;
  days: number[];
  since: string;
  ex?: boolean;
}

export type Remind =
  | { kind: "before"; lead: number }
  | { kind: "at"; time: string; dayBefore: boolean };

export interface Rule {
  id: string;
  match: string;
  barrier: BarrierKey;
  fix: string;
  remind: Remind;
  created: string;
  wins: number;
  fails: number;
  ex?: boolean;
}

export interface CheckIn {
  energy?: "low" | "steady" | "high";
  sleep?: number;
  ex?: boolean;
}

export interface State {
  v: 2;
  tasks: Task[];
  routines: Routine[];
  rules: Rule[];
  checkins: Record<string, CheckIn>;
}

export interface Cue {
  key: string;
  at: number; // minutes after midnight on the cue's day
  text: string;
  forTask: string;
  barrier?: BarrierKey;
  tomorrow: boolean;
  kind: "fix" | "transition";
}
