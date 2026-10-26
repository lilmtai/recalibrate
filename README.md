# Recalibrate

A calm ADHD planner for high achievers. Plan your day and week on a visual timeline, log why a block didn't happen, and turn each reason into an if-then fix that reminds you next time.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## What's in it

- **Day**: timeline coloured by area (Main work, Health, Social, Side hustle, Me time), energy/sleep check-in, "Now" card, reminders, "never miss twice" banner. Click an empty slot to add a block there.
- **Week**: plan Monday–Sunday, see hours per area, copy last week's blocks.
- **Routines**: sticky blocks that repeat on chosen weekdays (training, deep work, wind-down).
- **Playbook**: the if-then rules you created from misses, with a "worked X of Y" score.
- **Patterns**: follow-through by area, energy and sleep, top barriers, time-estimate multiplier.

Blocks take a start time plus an optional finish time or duration (fill one, the other follows), an optional energy level, and an "If not…" fallback for bad days.

Fixes can remind you a set time before the block, or at a clock time (for example 21:00 the night before: "set an alarm for tomorrow").

## Code map

```
src/
  App.tsx              tabs, pop-up panels, toasts
  ctx.ts               shared app context
  store.ts             localStorage save/load + migration from the first version
  types.ts             data model
  constants.ts         categories, barriers, suggested fixes
  useReminders.ts      in-app + browser notifications while the app is open
  example.ts           sample week
  lib/                 time helpers, plan (routines, reminders), stats
  components/          views and forms
```

## Data

Saved in the browser (localStorage). Reminders fire only while the app is open in a tab.

## Next steps

1. Accounts + sync across devices (Supabase).
2. Installable PWA with push notifications, so reminders work when the app is closed.
3. Focus timer.
4. AI coach via a serverless function calling the Claude API.
