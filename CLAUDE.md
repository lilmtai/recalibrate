# Recalibrate: project notes

A calm, premium ADHD planner for high achievers. Plan the day in blocks, log what really happened
(one tap where possible), turn misses into if-then fixes, and learn from the patterns.
Owner: Imam (GitHub `lilmtai`). Live: https://lilmtai.github.io/recalibrate/ (GitHub Pages, deploys on push to `main`).

## Product docs (read before changing architecture)
`docs/PRODUCT_VISION.md`, `docs/PRODUCT_REQUIREMENTS.md` (feature status: Done / Partial / Missing),
`docs/DATA_MODEL.md` (current model, weaknesses, target), `docs/SCHEDULING_RULES.md`, `docs/AI_BEHAVIOUR.md`,
`docs/UX_PRINCIPLES.md`, `docs/ROADMAP.md` (backlog with acceptance criteria; work it in order).
Rules for every agent (Claude Code, Codex):
- Never implement features that break the scheduling rules; the scheduling engine stays deterministic, separate from AI.
- Preserve historical execution data; corrections are explicit.
- No AI automation without an explicit user approval step.
- Write tests for scheduling and recovery logic.
- Update the docs (status tables, data model) whenever architecture or features change.
- Work in commits between handoffs so agents can take turns.

## Stack
- React 18 + TypeScript + Vite 5. No UI library; all styles in `src/index.css` (CSS variables).
- Local-first: state in localStorage (`recalibrate.v1`), synced to Supabase when signed in.
- Supabase project `lhrxjgzgyxlfzitrjzxp` (URL + publishable key in `src/lib/supabase.ts`; safe to be public, RLS protects data).
- PWA: `public/manifest.webmanifest`, `public/sw.js` (offline shell, Web Push, notification actions).
- Checks: `npm test` (Vitest, `src/**/*.test.ts`, fixtures in `src/test/`), `npx tsc -b`, `npm run build`.
  Tests run in the deploy workflow; a failing test blocks the release. UI flows: Playwright (preinstalled in cloud sessions).

## Code map
- `src/App.tsx`: shell, tabs, sheets (pop-up panels), toasts, deep links from notifications, applying notification answers.
- `src/ctx.ts`: app context + `SheetState` union (every pop-up panel) + `Tab` (`day | myday | work | week | patterns | playbook | me`).
  Bottom tabs: Today, My day, Work, Week (Plan / Insights / Playbook switch), Me.
- `src/types.ts`: data model (`State`, `Task`, `Routine`, `Rule`, `Note`, `Actual`, `CheckIn`, `FreeItem`, `Project`, `Step`, `Page`, `NotifyPrefs`).
  `PlanFields` (fixed, priority, deadline, difficulty, minDur, noPostpone, essential, desc) on blocks and routines, set in
  `BlockSheet` (Flexible / Fixed up top, the rest behind "More"). `Task.moves` = schedule history (`moveTask` in `lib/actions.ts`).
- `src/lib/schedule.ts`: the deterministic engine (tested): `proposeRecovery` ("Fix my day" / "Minimum day"),
  `applyRecovery`, `recoveryTrigger` (when Today offers it), `earliestFit`. UI: `components/RecoverSheet.tsx`
  (before → after, reasons, untick, Approve / Dismiss), "Fix my day" button + "Day slipping?" banner in `DayView`.
- `src/store.ts`: load/save/migrate state; `update(fn)` edits a structuredClone draft and stamps `updatedAt`.
- `src/sync.ts`: Supabase auth (password, email code, link) + sync of one `planner_state` row per user; merges on conflict.
- `src/usePwa.ts`: install prompt, push subscription, uploads the next 7 days of reminders to `push_queue`.
- `src/useReminders.ts`: in-app reminders/toasts while the app is open.
- `src/lib/plan.ts`: `tasksFor` (real tasks + virtual routine instances, ids `rt:<routineId>:<date>`), `materialize`, `cuesFor`, rules.
- `src/lib/actuals.ts`: "My day" entries (only what really happened): from block outcomes (`syncActuals`),
  the hourly WYD ("What are you doing?", `WydSheet`, `logSpan`, `logSame`, `wydFrom`) and manual entries. No plan-vs-actual view.
- WYD: `cuesFor` adds kind `wyd` on the hour during `dayHours`; notification buttons "Doing the plan" (`wplan`) / "Same as before" (`wsame`) log quietly.
- `src/lib/work.ts` + `components/WorkView.tsx` + `components/WorkSheets.tsx`: Work tab (projects, one next step each, steps,
  journal (`projectId: "journal"` = general), drafts, goals, quick capture).
- History ("what really happened") syncs through Supabase `execution_log` (`supabase/history.sql`): `src/useHistory.ts`
  (network, mode blob/table), `src/lib/historySync.ts` + `src/lib/history.ts` (pure, tested). Deletions go through
  `dropActuals` (tombstones); WYD answers carry `promptKey` so a prompt is logged once across devices.
- Start + focus mode: `lib/focus.ts` (pure, tested: start, 5-minute start, pause, +10/+30, done/partly, cancel) and
  `components/FocusView.tsx` (`FocusView` full screen, `FocusBar` when minimized). `state.focus` holds one session;
  during focus `cuesFor` adds a `focus` "time's up" cue and silences that block's prompts and hourly WYD.
- Blocks record `startedAt` / `endedAt` (`markStarted` / `markEnded` in `lib/actions.ts`); `startState()` tells
  never-started from started-unfinished. Old unfinished to-dos never roll over: `notesToReview` + `ReviewSheet`.
- `src/lib/answers.ts`: applies one-tap notification answers saved by the service worker (`recalibrate-pending` cache).
- `src/lib/stats.ts`, `src/lib/push.ts`, `src/lib/time.ts`, `src/constants.ts`, `src/example.ts` (example week, flagged `ex`).
- Free blocks (`FreeItem` in `state.free`): no set time, repeat every N days, show as due in the to-do card,
  remind at `remindAt` daily while due/overdue (`cuesFor` kind `free`), Done moves `nextDue` forward (`lib/actions.ts`).
- Sheets: `Sheet` has a grab handle (swipe down), ← back (panel stack in `App`), ✕ close; the phone back gesture closes it.
- Today is schedule-first (owner: "too crowded", "good morning and straight to the plan"): header, then **at most one** slim `Notice` line
  (energy question → "Day slipping?" → not logged → never miss twice → low fuel), each closable with ✕ for the day
  (`useHidden`, localStorage `recalibrate.hidden`), then "‹ Today ›" day arrows + Reorganize / Fix my day, then the timeline. No week strip (removed).
  Below it on phones: Now / Up next card (✕ hides it for the day; a "Show “Now”" chip brings it back), to-dos,
  reminders, "N of M done" + energy/sleep chips. "Add block" is hidden on phones (the + button does it). Don't add cards above the day.
- `src/components/`: `DayView` (Today: notice line, timeline, reorganize + tray, Now card, to-dos + due free blocks), `Timeline`, `MyDayView`, `WeekView`,
  `PatternsView`, `PlaybookView`, `MeView` (routines, day hours, account, phone app, example data), and the sheets
  (`BlockSheet`, `LogSheet`, `WhySheet` (one-tap reason), `MissSheet`/`CheckSheet`, `AskSheet`, `FreeSheet`/`FreeDueSheet`,
  `EntrySheet`, `QuickSheet`, `WelcomeSheet`, `SetupSheet` (+ `lib/pushCheck.ts` "Check notifications"), `AccountSheet`).
- Today has **one** hour-by-hour day view (`components/Timeline.tsx`, 76px/hour):
  each block has an emoji pill, times "13:30 – 14:00 (30m)" + title, category tint and a one-tap ✓ circle. Three sizes:
  `short` (<30 min, one line), `mid` (30 min, two small lines), `tall`. Side-by-side lanes for overlaps and free-time
  "tap to plan" boxes come from `lib/dayLayout.ts` (pure, tested). Reorganize, drag, resize and tray placing use the same view.
- Native-app sizing: viewport locked (`index.html`), pinch blocked in `lib/zoom.ts`, `touch-action: manipulation`,
  every field 16px+ (rule at the end of `index.css`), `overflow-x` clipped. Keep new fields ≥16px; check `scrollWidth` = 390.
- Ongoing blocks (`Task.ongoing`, no finish time): drawn growing with the clock (`shownDur`), no halfway/end prompts,
  ✓ (`completeTask`) records the real length.
- Routine instances: editing asks "This day only" vs "Every week"; moving one in Reorganize offers "Every week" in a toast.
- `supabase/schema.sql`, `supabase/push.sql`, `supabase/functions/send-push/index.ts`: server side (run/deployed by the owner in the dashboard).

## Design rules
- Simple neutral palette (owner, Nov 2026: "something simple"; replaced the champagne/navy/gold one): light = soft grey
  `#f6f6f7` ground, white cards, near-black ink + buttons `#111114`; dark = `#0b0b0c` ground, `#161618` cards, white
  buttons. One blue (`--gold` token, name kept) marks now / focus / wins.
  Me → Appearance: Auto / Light / Dark per device (`lib/theme.ts`, `data-theme` on <html>, localStorage `recalibrate.theme`);
  dark tokens live twice in `index.css` (prefers-dark unless `data-theme="light"`, and `data-theme="dark"`), same for category colours in `App`. Orange (`--warn`) only means "needs attention".
- Categories are data (`state.categories`, defaults in `constants.ts → DEFAULT_CATEGORIES`: work, side hustle, health,
  social, me time, cooking, cleaning, errands, learning, admin, family, rest). Users add / rename / recolour / remove them
  (`CategorySheet`). Colours become CSS variables `--c-<key>` injected by `App`; use `categoriesOf` / `catOf` / `catLabel`.
- Fonts: DM Serif Display (headings) + Plus Jakarta Sans. UI icons: inline SVG in `components/Icon.tsx`.
  **Emoji are used only as block / category icons** (owner's request): `lib/emoji.ts → suggestEmoji` picks one from the
  title, users can override (`Task.emoji`, `Routine.emoji`).
- Low friction above all: one tap where possible, no judgement in copy, "if not" fallbacks, celebrate wins (gold check + vibration).
- Phone first: bottom tab bar, + button, test at 390px wide and in dark mode.

## Owner-side setup status (Supabase dashboard)
- `schema.sql`: done (sync works). `history.sql`: done (Me shows "stored in its own table").
- `push.sql` + `send-push` function + secrets: done; the test notification arrives on the owner's iPhone.
  If reminders don't arrive, run Me → Phone app & notifications → Check notifications (it uploads and lists the schedule).
  The VAPID private key and cron secret are NOT in the repo; only the public key is (`src/lib/push.ts`).
- Email templates can't be edited without custom SMTP, so the emailed code isn't sent. Sign-in uses email + password instead.
  Recommended: Authentication → Sign In / Providers → Email → turn OFF "Confirm email" (or set up SMTP: Gmail app password or Resend).

## Owner requests queued
Done: sizing/zoom lock, one day view, fixed/flexible + priority/deadline, Fix my day. Next: the roadmap (see `docs/ROADMAP.md`).

## Known limits / next steps
- iPhone web push shows no action buttons; tapping opens a one-tap question (`AskSheet`). Native buttons need the App Store build.
- Reminders are scheduled 7 days ahead whenever the plan changes; they stop if the app isn't opened for a week.
- Next: see `docs/ROADMAP.md`. Done: Sprint 0, Sprint 1 P-1/P-2, Sprint 2 E-1/E-2/E-6, Sprint 3 (Fix my day, minimum day).
  Next up: Sprint 1 P-3/P-4 (capacity indicator, overload warning; reuse `lib/schedule.ts`), P-6, then Sprint 2 E-3/E-4/E-5.

## Conventions
- Commit to `main` only when asked; deploy is automatic. End commit messages with the session's attribution lines.
- Keep copy plain and short; user-facing language, no jargon.
