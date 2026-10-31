# UX principles

## Interaction budget
| Action | Target |
| --- | --- |
| Answer a check-in (WYD, halfway, end) | 1 tap, under 10 s; more questions only if needed |
| Log why something didn't happen | 1 tap; details optional afterwards |
| Capture a distracting thought | 1 field + Enter, from anywhere (+ button) |
| Start a task | 1 tap on Start |
| Recover a broken day | 1 tap to get a proposal, 1 tap to approve |

## Rules
- **No punishment.** No red failure states, no broken streaks, no guilt copy. Orange (`--warn`) means
  "needs attention", never "you failed".
- **Celebrate small wins** (gold check + light vibration).
- **One next thing.** Each surface leads with the single most useful action (Now card, next step per project).
- **Progressive disclosure.** Advanced fields (priority, deadline, difficulty) are tucked behind "More".
- **Every panel can be closed** (✕), swiped down, or dismissed with the phone's back gesture; panels opened
  from another panel have ← Back.
- **Proposals, not surprises.** Anything the app changes on its own is shown as a proposal first.
- **Plain language.** Name things as people say them ("My day", "What are you doing?"), short sentences.

## Platforms
- **Mobile (primary for doing):** check-ins, notifications, Start / focus, capture, quick rescheduling.
  Bottom tab bar, + button, test at 390 px and in dark mode.
- **Desktop (primary for planning):** week planning, analytics, detailed editing, weekly review. Use the
  width: side-by-side panels, drag across days.

## Visual system
- Champagne palette: ivory `#fbf8f2`, navy `#18224a`, champagne gold `#c9a45c`; dark mode navy + gold.
- Areas: work `#2c49a6`, health `#2f8466`, social `#b84d72`, side hustle `#6e52a3`, me time `#2c8799`.
- Fonts: DM Serif Display (headings), Plus Jakarta Sans (everything else). Inline SVG UI icons; emoji only as
  block / category icons (suggested from the title, user can change).
- Today: week strip on top, then one hour-by-hour day view. Blocks show an emoji pill, "13:30 – 14:00 (30m)",
  the title and a one-tap ✓; 15-minute blocks fit on one line. Free time says "tap to plan". The same view is used
  for Reorganize (drag, resize, tray).
- Feels native: no pinch / double-tap / field zoom (fields are 16px+), nothing wider than the screen.
- Motion: short (≤ 280 ms), respects reduced-motion.

## Notifications
Three modes (to build, TA-9):
- **Strict:** hourly WYD + all block prompts.
- **Adaptive (default):** prompts around block starts/ends and WYD only in unlogged stretches.
- **Minimal:** fixed appointments, missed check-ins, due floating tasks.
On iPhone, web notifications have no buttons: tapping opens a one-tap screen. Native buttons come with the
App Store build.
