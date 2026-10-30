# Recalibrate

A calm ADHD planner for high achievers. Plan your day and week on a visual timeline, log why a block didn't happen, and turn each reason into an if-then fix that reminds you next time.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Look and navigation

Champagne palette (ivory, deep navy, champagne gold; dark mode in deep navy with gold), DM Serif Display + Plus Jakarta Sans.
Five tabs (bottom bar on phones): **Today**, **My day** (plan vs. what really happened), **Week**, **Insights** (Patterns / Playbook), **Me** (routines, day hours, account, phone app, example data).
A + button adds anything; finishing a block or to-do gets a small gold moment and a light vibration.
First visit runs a 1-minute setup (day hours + starter routines).

## What's in it

- **Day**: full 24-hour timeline coloured by area (Main work, Health, Social, Side hustle, Me time), energy/sleep check-in, "Now" card, reminders, "never miss twice" banner. Click an empty slot to add a block there.
- **To do today (post-its)**: quick to-dos with no time. Unfinished ones roll over to the next day. Drag one onto the timeline (or tap it, then tap a time) to schedule it.
- **Reorganize**: drag blocks to move them, drag the bottom edge to change length, send blocks to a tray (or "Clear the rest of today") and drag them back where they fit.
- **Log what really happened**: Done / Partly done / "If not" version / Didn't happen. For partial or missed blocks, one tap logs what filled the time instead (phone, other work, hyperfocus, people…).
- **Check-ins**: a halfway "still on it?" prompt and an end-of-block "log it" prompt (in-app, and as notifications when allowed). Blocks that ended without a log are listed at the top of the day.
- **My day**: a second timeline beside the plan showing what really happened. Logging a block fills it in automatically (done, the part done plus what took the rest, or what filled a missed slot). "What are you doing right now?" starts a running entry in one tap; tap any empty spot to add something you did. A summary compares planned vs. actual time overall and per area.
- **Week**: plan Monday–Sunday, see hours per area, copy last week's blocks.
- **Routines**: sticky blocks that repeat on chosen weekdays (training, deep work, wind-down).
- **Playbook**: the if-then rules you created from misses, with a "worked X of Y" score.
- **Patterns**: follow-through by area, energy and sleep, top barriers, where the time went instead, planned vs. actual time per block, halfway drift, time-estimate multiplier.

Blocks take a start time plus an optional finish time or duration (fill one, the other follows), an optional energy level, and an "If not…" fallback for bad days.

Fixes can remind you a set time before the block, or at a clock time (for example 21:00 the night before: "set an alarm for tomorrow").

## Code map

```
src/
  App.tsx              tabs, pop-up panels, toasts
  ctx.ts               shared app context
  store.ts             localStorage save/load + migration from the first version
  sync.ts              Supabase sign-in and sync
  usePwa.ts            install prompt + push subscription + reminder schedule upload
  types.ts             data model
  constants.ts         categories, barriers, suggested fixes
  useReminders.ts      in-app + browser notifications while the app is open
  example.ts           sample week
  lib/                 time helpers, plan (routines, reminders), stats
  components/          views and forms
```

## Live app

Every push to `main` builds and publishes to https://lilmtai.github.io/recalibrate/ (workflow in `.github/workflows/deploy.yml`).
One-time setup: repo Settings → Pages → Source: **GitHub Actions**.

## Data and sync

The app is local-first: it always saves in the browser (localStorage) and works offline.
Signing in (email link, no password) syncs the planner to Supabase so phone and laptop share it.

- `src/sync.ts` pulls on sign-in, on tab focus and every minute, and pushes edits after ~1 s.
  If two devices both changed things, the planners are merged (nothing is dropped).
- `src/lib/supabase.ts` holds the project URL and publishable key (safe to be public).
  Override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` in `.env.local`.

One-time Supabase setup:
1. SQL Editor → run `supabase/schema.sql` (creates the table and row-level security).
2. Authentication → URL Configuration: Site URL `https://lilmtai.github.io/recalibrate/`,
   and add Redirect URLs `https://lilmtai.github.io/recalibrate/**` and `http://localhost:5173/**`.

## Phone app and notifications

The app is an installable PWA (`public/manifest.webmanifest`, `public/sw.js`): Home Screen icon, full-screen, works offline.
Sign-in accepts the emailed code, so it works inside the installed app (add `{{ .Token }}` to the Supabase email templates).

Notifications that arrive when the app is closed:

1. Each device that turns on notifications saves a Web Push subscription (`push_subscriptions`).
2. Whenever the plan changes, the app writes the next 7 days of reminders to `push_queue`
   (5 min before a block, halfway check-in, end-of-block log prompt, fix reminders).
3. `pg_cron` calls the `send-push` Edge Function every minute; it sends what's due with Web Push.
4. Notification buttons answer without opening the app: "I'm on it" / "Still on it" / "Done" are saved by the
   service worker (`recalibrate-pending` cache) and applied by the app when it next runs (`src/lib/answers.ts`).
   "Not doing it" / "Not done" open the app to log what happened instead. A plain tap (iPhone shows no buttons)
   opens a one-tap question (`?task=…&do=ask&kind=start|mid|end`).

Setup: run `supabase/push.sql`, deploy `supabase/functions/send-push` with JWT verification off,
and set its secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
The VAPID public key is also in `src/lib/push.ts`. On iPhone, push needs iOS 16.4+ and the Home Screen app.

While the app is open, the same reminders also show as in-app toasts.

## Next steps

1. Focus timer.
2. Weekly plan-vs-reality review.
3. AI coach via a Supabase Edge Function calling the Claude API.
