import type { BarrierKey, CategoryKey, Energy, InsteadKey, Remind } from "./types";

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "work", label: "Main work" },
  { key: "health", label: "Health" },
  { key: "social", label: "Social" },
  { key: "side", label: "Side hustle" },
  { key: "me", label: "Me time" },
];
export const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label])) as Record<CategoryKey, string>;

export const ENERGY_LABEL: Record<Energy, string> = { low: "Low", med: "Medium", high: "High" };

export const BARRIERS: { key: BarrierKey; label: string }[] = [
  { key: "energy", label: "Low energy" },
  { key: "bloated", label: "Bloated / hungry" },
  { key: "overwhelm", label: "Overwhelmed" },
  { key: "time", label: "Lost track of time" },
  { key: "forgot", label: "Forgot" },
  { key: "avoid", label: "Avoiding it" },
  { key: "sleep", label: "Poor sleep" },
  { key: "cameup", label: "Something came up" },
];
export const BARRIER_LABEL = Object.fromEntries(BARRIERS.map((b) => [b.key, b.label])) as Record<BarrierKey, string>;

const before = (lead: number): Remind => ({ kind: "before", lead });
const eve = (time: string): Remind => ({ kind: "at", time, dayBefore: true });

export const SUGGESTED_FIXES: Record<BarrierKey, { fix: string; remind: Remind }[]> = {
  energy: [
    { fix: "Small snack with protein", remind: before(60) },
    { fix: "10-minute walk outside first", remind: before(30) },
    { fix: "Do the 'if not' version only", remind: before(15) },
  ],
  bloated: [
    { fix: "Eat a light meal earlier", remind: before(90) },
    { fix: "Keep lunch light on these days", remind: before(240) },
    { fix: "Water, no food, in the last hour", remind: before(60) },
  ],
  overwhelm: [
    { fix: "Write the first 2-minute step", remind: eve("21:00") },
    { fix: "Cut scope to the 'if not' version", remind: before(15) },
    { fix: "Start a 25-min timer, stop after", remind: before(10) },
  ],
  time: [
    { fix: "Transition alarm: wrap up", remind: before(10) },
    { fix: "Block a 15-min buffer before", remind: before(15) },
    { fix: "Put a visual timer on screen", remind: before(30) },
  ],
  forgot: [
    { fix: "Set an alarm for tomorrow", remind: eve("21:00") },
    { fix: "Lay out what you need tonight", remind: eve("21:30") },
    { fix: "Stack it after an existing habit", remind: before(15) },
  ],
  avoid: [
    { fix: "Name the hard part, do it for 5 min", remind: before(10) },
    { fix: "Line up a reward for after", remind: before(30) },
    { fix: "Commit to just showing up", remind: before(15) },
  ],
  sleep: [
    { fix: "Phone out of the bedroom", remind: eve("22:30") },
    { fix: "Move hard work to the morning", remind: before(60) },
  ],
  cameup: [
    { fix: "Pick a new slot right away", remind: before(15) },
    { fix: "Keep 20% of the day unbooked", remind: before(120) },
  ],
};

export const LEADS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240];

/** One-tap answers to "what did you do instead?" */
export const INSTEAD: { key: InsteadKey; label: string }[] = [
  { key: "phone", label: "Phone / scrolling" },
  { key: "otherwork", label: "Other work" },
  { key: "urgent", label: "Urgent request" },
  { key: "hyperfocus", label: "Hyperfocus on something else" },
  { key: "people", label: "Talking to someone" },
  { key: "chores", label: "Chores / errands" },
  { key: "food", label: "Eating" },
  { key: "rest", label: "Rest / nap" },
  { key: "late", label: "Running late" },
  { key: "unknown", label: "Can't remember" },
];
export const INSTEAD_LABEL = Object.fromEntries(INSTEAD.map((i) => [i.key, i.label])) as Record<InsteadKey, string>;
