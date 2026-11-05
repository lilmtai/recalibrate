export type Energy = "low" | "med" | "high";
/** A category key: a built-in one ("work", "cooking"…) or one you created ("c_ab12cd"). */
export type CategoryKey = string;

/** A category (area of life) with its colour and emoji. Yours to rename, recolour, add or remove. */
export interface Category {
  key: CategoryKey;
  label: string;
  color: string; // hex
  emoji: string;
}
export type BarrierKey =
  | "energy" | "bloated" | "overwhelm" | "time" | "forgot" | "avoid" | "sleep" | "cameup"
  | "distracted" | "hardstart" | "longer" | "other";
export type InsteadKey =
  | "phone" | "otherwork" | "urgent" | "rest" | "food" | "chores" | "people" | "hyperfocus" | "late" | "unknown";
/** done = full block, partial = some of it, ifnot = did the "if not" fallback, skipped = removed for that day */
export type Status = "open" | "done" | "partial" | "ifnot" | "missed" | "skipped";

/** What actually filled the time when a block didn't (fully) happen. */
export interface Instead {
  what: InsteadKey[];
  note?: string;
}

/** A mid-block check-in: were you on it? */
export interface Check {
  at: number; // minutes after midnight
  on: boolean;
  what?: InsteadKey[];
}

/** A post-it: something to do today with no time slot yet. Unfinished ones roll over. */
export interface Note {
  id: string;
  date: string;
  text: string;
  done: boolean;
  doneDate?: string;
  ex?: boolean;
}

export type Priority = "low" | "normal" | "high";
export type Difficulty = "easy" | "medium" | "hard";

/**
 * Planning details shared by blocks and routines (P-1 / P-2). All optional: an empty field means the
 * default (flexible, normal priority, can be postponed), so the quick form stays quick.
 */
export interface PlanFields {
  /** fixed = an appointment: keeps its time; moving it asks first, "Fix my day" never moves it */
  fixed?: boolean;
  priority?: Priority;
  /** last day it can happen (YYYY-MM-DD) */
  deadline?: string;
  /** how hard it is to get going */
  difficulty?: Difficulty;
  /** shortest useful version, in minutes */
  minDur?: number;
  /** true = has to happen today, never postponed to another day */
  noPostpone?: boolean;
  /** essential care (meals, meds, sleep prep): kept in a minimum day */
  essential?: boolean;
  desc?: string;
}

/** One change to a block's time (schedule history, R-5). */
export interface Move {
  /** ISO time of the change */
  at: string;
  from: string; // HH:MM
  to: string; // HH:MM, or "" when taken off the day
  fromDur?: number;
  toDur?: number;
  /** moved to another day */
  toDate?: string;
  source: "user" | "recovery" | "ai";
}

export interface Task extends PlanFields {
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
  /** when you really started / finished (ISO), recorded by Start, "I'm on it", WYD, or logging it done */
  startedAt?: string;
  endedAt?: string;
  /** emoji shown next to the block (suggested from the title, or picked) */
  emoji?: string;
  /** no finish time: runs until you mark it finished; `dur` is a placeholder until then */
  ongoing?: boolean;
  /** minutes added with "+10 / +30" when time ran out */
  extendedMin?: number;
  /** in the reorganize tray, not on the timeline */
  unplaced?: boolean;
  /** share of the block done, for "partial" (0.25 / 0.5 / 0.75) */
  share?: number;
  instead?: Instead;
  checks?: Check[];
  /** every change to its time, oldest first */
  moves?: Move[];
  ex?: boolean;
}

/** A sticky block: repeats on the chosen weekdays (0 = Monday … 6 = Sunday). */
export interface Routine extends PlanFields {
  id: string;
  title: string;
  start: string;
  dur: number;
  category: CategoryKey;
  energy?: Energy;
  ifNot?: string;
  days: number[];
  since: string;
  emoji?: string;
  ongoing?: boolean;
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
  /** dismissed the morning check-in for this day */
  skipped?: boolean;
  ex?: boolean;
}

/**
 * One stretch of what really happened (the "My day" column).
 * kind: plan = did (part of) a planned block, instead = something else during a planned block,
 * free = anything else you log. auto = written by logging a block; manual entries are kept as-is.
 */
export interface Actual {
  id: string;
  date: string;
  start: number; // minutes after midnight
  end?: number; // undefined while it's running ("Now doing")
  title: string;
  kind: "plan" | "instead" | "free";
  category?: CategoryKey;
  insteadKey?: InsteadKey;
  taskId?: string;
  auto?: boolean;
  /** which prompt this answers (e.g. "wyd:2026-11-04:600"), so a prompt is logged only once */
  promptKey?: string;
  ex?: boolean;
}

/**
 * A free block: something with no set time that comes back every N days
 * (barbershop every 2 weeks). It shows up as due on your to-do list and reminds you.
 */
export interface FreeItem {
  id: string;
  title: string;
  category: CategoryKey;
  /** 0 = just once */
  everyDays: number;
  nextDue: string; // YYYY-MM-DD
  remindAt: string; // HH:MM
  lastDone?: string;
  ex?: boolean;
}

/** A running focus session for a block. Times are ISO strings so every device agrees. */
export interface Focus {
  taskId: string;
  date: string;
  startedAt: string;
  endsAt: string;
  /** "five" = the 5-minute start; "block" = working through the block */
  mode: "five" | "block";
  pausedAt?: string;
  pausedMs: number;
  /** id of the running My day entry */
  actualId: string;
}

/** A project in the Work tab. */
export interface Project {
  id: string;
  name: string;
  area: CategoryKey;
  /** why it matters / the outcome you're after */
  why?: string;
  status: "active" | "paused" | "done";
  created: string;
  ex?: boolean;
}

/** One thing to do in a project. The pinned one (or the first open one) is the project's next step. */
export interface Step {
  id: string;
  projectId: string;
  text: string;
  done: boolean;
  doneAt?: string;
  order: number;
  next?: boolean;
  ex?: boolean;
}

/** Writing in the Work tab: a journal entry, a draft, or a goal. projectId "journal" = general journal. */
export interface Page {
  id: string;
  projectId: string;
  kind: "journal" | "draft" | "goal";
  title?: string;
  text: string;
  created: string; // ISO date-time
  updated?: string;
  target?: string; // goals: YYYY-MM-DD
  achieved?: boolean;
  ex?: boolean;
}

/** Which notifications to send when the app is closed (synced across devices). */
export interface NotifyPrefs {
  enabled: boolean;
  start: boolean; // 5 minutes before a block
  mid: boolean; // halfway "still on it?"
  end: boolean; // "log what happened"
  fix: boolean; // reminders from your fixes
  free?: boolean; // free blocks that are due
  wyd?: boolean; // hourly "what are you doing?"
}

export interface State {
  v: 2;
  tasks: Task[];
  routines: Routine[];
  rules: Rule[];
  checkins: Record<string, CheckIn>;
  notes: Note[];
  actuals: Actual[];
  /** ids of history entries you deleted, waiting to be marked deleted on the server */
  actualTomb?: string[];
  free: FreeItem[];
  projects: Project[];
  steps: Step[];
  pages: Page[];
  notify?: NotifyPrefs;
  /** your categories; when missing, the defaults are used */
  categories?: Category[];
  /** the block you're focusing on right now (one at a time) */
  focus?: Focus;
  /** usual waking hours; the timeline folds away the rest */
  dayHours?: { start: string; end: string };
  /** finished (or skipped) first-time setup */
  onboarded?: boolean;
  /** ms timestamp of the last local edit, used for sync */
  updatedAt?: number;
}

export interface Cue {
  key: string;
  at: number; // minutes after midnight on the cue's day
  text: string;
  forTask: string;
  barrier?: BarrierKey;
  tomorrow: boolean;
  kind: "fix" | "transition" | "mid" | "end" | "free" | "wyd" | "focus";
  taskId?: string;
  freeId?: string;
}
