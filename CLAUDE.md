# Recalibrate: project notes

A calm, premium ADHD planner for high achievers. Plan the day in blocks, log what really happened
(one tap where possible), turn misses into if-then fixes, and learn from the patterns.
Owner: Imam (GitHub `lilmtai`). Live: https://lilmtai.github.io/recalibrate/ (GitHub Pages, deploys on push to `main`).

## Stack
- React 18 + TypeScript + Vite 5. No UI library; all styles in `src/index.css` (CSS variables).
- Local-first: state in localStorage (`recalibrate.v1`), synced to Supabase when signed in.
- Supabase project `lhrxjgzgyxlfzitrjzxp` (URL + publishable key in `src/lib/supabase.ts`; safe to be public, RLS protects data).
- PWA: `public/manifest.webmanifest`, `public/sw.js` (offline shell, Web Push, notification actions).
- Checks: `npx tsc -b` and `npm run build`. No test suite; verify flows with Playwright (preinstalled in cloud sessions).

## Code map
- `src/App.tsx`: shell, tabs, sheets (pop-up panels), toasts, deep links from notifications, applying notification answers.
- `src/ctx.ts`: app context + `SheetState` union (every pop-up panel) + `Tab` (`day | myday | week | patterns | playbook | me`).
- `src/types.ts`: data model (`State`, `Task`, `Routine`, `Rule`, `Note`, `Actual`, `CheckIn`, `NotifyPrefs`).
- `src/store.ts`: load/save/migrate state; `update(fn)` edits a structuredClone draft and stamps `updatedAt`.
- `src/sync.ts`: Supabase auth (password, email code, link) + sync of one `planner_state` row per user; merges on conflict.
- `src/usePwa.ts`: install prompt, push subscription, uploads the next 7 days of reminders to `push_queue`.
- `src/useReminders.ts`: in-app reminders/toasts while the app is open.
- `src/lib/plan.ts`: `tasksFor` (real tasks + virtual routine instances, ids `rt:<routineId>:<date>`), `materialize`, `cuesFor`, rules.
- `src/lib/actuals.ts`: "My day" entries written from block outcomes (`syncActuals`) + day summary.
- `src/lib/answers.ts`: applies one-tap notification answers saved by the service worker (`recalibrate-pending` cache).
- `src/lib/stats.ts`, `src/lib/push.ts`, `src/lib/time.ts`, `src/constants.ts`, `src/example.ts` (example week, flagged `ex`).
- `src/components/`: `DayView` (Today: check-in, timeline, reorganize + tray, to-dos), `Timeline`, `MyDayView`, `WeekView`,
  `PatternsView`, `PlaybookView`, `MeView` (routines, day hours, account, phone app, example data), and the sheets
  (`BlockSheet`, `LogSheet`, `MissSheet`/`CheckSheet`, `AskSheet`, `EntrySheet`, `QuickSheet`, `WelcomeSheet`, `SetupSheet`, `AccountSheet`).
- `supabase/schema.sql`, `supabase/push.sql`, `supabase/functions/send-push/index.ts`: server side (run/deployed by the owner in the dashboard).

## Design rules
- Champagne palette: ivory `#fbf8f2`, navy `#18224a` (ink + primary), champagne gold `#c9a45c` for special moments.
  Dark mode: navy ground, gold primary. Orange (`--warn`) only means "needs attention".
- Areas: work `#2c49a6`, health `#2f8466`, social `#b84d72`, side hustle `#6e52a3`, me time `#2c8799`.
- Fonts: DM Serif Display (headings) + Plus Jakarta Sans. Icons: inline SVG in `components/Icon.tsx`, never emoji.
- Low friction above all: one tap where possible, no judgement in copy, "if not" fallbacks, celebrate wins (gold check + vibration).
- Phone first: bottom tab bar, + button, test at 390px wide and in dark mode.

## Owner-side setup status (Supabase dashboard)
- `schema.sql`: done (sync works).
- `push.sql` + `send-push` function + secrets (VAPID keys, CRON_SECRET): steps were given to the owner; confirm they're done if push fails.
  The VAPID private key and cron secret are NOT in the repo; only the public key is (`src/lib/push.ts`).
- Email templates can't be edited without custom SMTP, so the emailed code isn't sent. Sign-in uses email + password instead.
  Recommended: Authentication → Sign In / Providers → Email → turn OFF "Confirm email" (or set up SMTP: Gmail app password or Resend).

## Known limits / next steps
- iPhone web push shows no action buttons; tapping opens a one-tap question (`AskSheet`). Native buttons need the App Store build.
- Reminders are scheduled 7 days ahead whenever the plan changes; they stop if the app isn't opened for a week.
- Next: App Store version with Capacitor (local notifications with actions, haptics), account deletion (Apple requirement),
  privacy policy, custom SMTP, weekly plan-vs-reality review, focus timer.

## Conventions
- Commit to `main` only when asked; deploy is automatic. End commit messages with the session's attribution lines.
- Keep copy plain and short; user-facing language, no jargon.
