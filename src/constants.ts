import type { BarrierKey, Category, Energy, InsteadKey, Remind } from "./types";

/** Built-in categories. Colours are tuned for the ivory background; dark mode lightens them. */
export const DEFAULT_CATEGORIES: Category[] = [
  { key: "work", label: "Main work", color: "#2c49a6", emoji: "💼" },
  { key: "side", label: "Side hustle", color: "#6e52a3", emoji: "🚀" },
  { key: "health", label: "Health", color: "#2f8466", emoji: "🏃" },
  { key: "social", label: "Social", color: "#b84d72", emoji: "🥂" },
  { key: "me", label: "Me time", color: "#2c8799", emoji: "🧘" },
  { key: "cooking", label: "Cooking", color: "#c0612b", emoji: "🍳" },
  { key: "cleaning", label: "Cleaning", color: "#4f7f9e", emoji: "🧹" },
  { key: "errands", label: "Errands", color: "#8a6a1f", emoji: "🛒" },
  { key: "learning", label: "Learning", color: "#5b5fc7", emoji: "📚" },
  { key: "admin", label: "Admin", color: "#5e6176", emoji: "🗂️" },
  { key: "family", label: "Family", color: "#a3477e", emoji: "👨‍👩‍👧" },
  { key: "rest", label: "Rest & sleep", color: "#3d5a80", emoji: "😴" },
];
/** For places with no access to your state (examples, onboarding). */
export const CATEGORIES = DEFAULT_CATEGORIES;
export const CAT_LABEL = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.key, c.label])) as Record<string, string>;

/** Your categories (or the defaults), and lookups that never fail. */
export const categoriesOf = (s: { categories?: Category[] }): Category[] => (s.categories?.length ? s.categories : DEFAULT_CATEGORIES);
export const catOf = (s: { categories?: Category[] }, key?: string): Category =>
  categoriesOf(s).find((c) => c.key === key) || DEFAULT_CATEGORIES.find((c) => c.key === key) || { key: key || "other", label: "Other", color: "#8a8c9e", emoji: "•" };
export const catLabel = (s: { categories?: Category[] }, key?: string) => catOf(s, key).label;

export const ENERGY_LABEL: Record<Energy, string> = { low: "Low", med: "Medium", high: "High" };

// The spec's standard reasons first, then the owner's own.
export const BARRIERS: { key: BarrierKey; label: string }[] = [
  { key: "distracted", label: "Distracted" },
  { key: "hardstart", label: "Hard to start" },
  { key: "longer", label: "Took longer than planned" },
  { key: "energy", label: "Low energy" },
  { key: "cameup", label: "Something came up" },
  { key: "avoid", label: "Avoiding it" },
  { key: "forgot", label: "Forgot" },
  { key: "time", label: "Lost track of time" },
  { key: "overwhelm", label: "Overwhelmed" },
  { key: "bloated", label: "Bloated / hungry" },
  { key: "sleep", label: "Poor sleep" },
  { key: "other", label: "Other" },
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
  distracted: [
    { fix: "Phone in another room", remind: before(5) },
    { fix: "Close every tab except this one", remind: before(5) },
    { fix: "Park stray thoughts in Capture, not your head", remind: before(5) },
  ],
  hardstart: [
    { fix: "Just 5 minutes, then decide", remind: before(5) },
    { fix: "Write the first 2-minute step", remind: eve("21:00") },
    { fix: "Lay everything out before it starts", remind: before(15) },
  ],
  longer: [
    { fix: "Plan it 1.5× longer", remind: before(30) },
    { fix: "Split it into two smaller blocks", remind: eve("21:00") },
  ],
  other: [
    { fix: "Pick a new slot right away", remind: before(15) },
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
