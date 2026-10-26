# Recalibrate

A calm ADHD planner for high achievers. Plan your day and week on a visual timeline, log why a block didn't happen, and turn each reason into an if-then fix that reminds you next time.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

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

Reminders fire only while the app is open in a tab.

## Next steps

1. Installable PWA with push notifications, so reminders work when the app is closed.
2. Focus timer.
3. AI coach via a Supabase Edge Function calling the Claude API.
