# Product requirements and current status

Status: **Done** · **Partial** (exists but short of the spec) · **Missing**.
Audit date: 2026-10-31 (commit `6b1f534`); updated after Sprint 0, Sprint 1 P-1/P-2 and Sprint 3. Priorities P0 / P1 / P2 from the product spec.
Backlog items in `ROADMAP.md` reference these IDs.

## Module 1 · Daily planner (P0)

| ID | Requirement | Status | Notes / where |
| --- | --- | --- | --- |
| DP-1 | Block types: **fixed**, **flexible**, **floating** | Done | Block form has Flexible / Fixed (`Task.fixed`, `Routine.fixed`). Fixed blocks show a lock; dragging one asks first. Floating = to-dos (`Note`) and free blocks (`FreeItem`). |
| DP-2 | Block fields: title, description, start/end, est. duration, priority, category, energy, starting difficulty, recurrence, deadline, minimum acceptable duration, can-postpone | Done | All present. Behind "More" in the block form: priority, deadline, starting difficulty, minimum version (minutes), "has to happen today" (= can't postpone), essential care, notes (`PlanFields` in `types.ts`). |
| DP-3 | Don't fit a 60-min task in a 20-min gap | Partial | The engine (`lib/schedule.ts → earliestFit`) never proposes a block in a gap shorter than it. Manual drags can still overlap (allowed, shown side by side). |
| DP-4 | Transition buffers around high-focus blocks | Partial | "Fix my day" keeps 10 min free after a 60+ min high-energy or hard block. Not yet shown in manual planning. |
| DP-5 | Fixed appointments preserved | Done | The engine never moves fixed blocks; Reorganize asks before moving one. |
| DP-6 | Recurring tasks never silently disappear | Done | Routines are generated per day (`tasksFor`); edits ask "this day / every week". |
| DP-7 | No automatic overflow of unfinished work into tomorrow | Done | Nothing rolls over. Old unfinished to-dos wait in "N unfinished from before · Review" (`ReviewSheet`): today / pick a day / drop. |
| DP-8 | Daily capacity limited by realistic available time | Done | `capacity()` in `lib/schedule.ts`: day hours minus time passed minus fixed appointments; "realistic" uses your time multiplier. |
| DP-9 | Capacity indicator: available / planned / buffer / unallocated | Done | Slim bar under the day header ("2h free · 5h planned"); tap for the breakdown (`CapacitySheet`). |
| DP-10 | Overload warning when planned > available | Done | "More than fits · 1h 30m over" notice (closable) → "Make it fit": Shorten / Postpone / Rearrange proposals (`proposeLighten`), approve or untick. |
| DP-11 | Finish can't be before start | Done | `BlockSheet`. |

## Module 2 · Time awareness (P0)

| ID | Requirement | Status | Notes / where |
| --- | --- | --- | --- |
| TA-1 | Live countdown for the current block | Done | Now card (`DayView` → `NowCard`). |
| TA-2 | Visual progress through the current hour | Partial | Progress bar per block and a "now" line on the timeline; no hour-progress view. |
| TA-3 | Notifications before transitions | Done | 5-min "starts soon" (push + in-app). |
| TA-4 | Hourly execution check-ins | Done | WYD on the hour during waking hours. |
| TA-5 | Actual start and finish timestamps | Done | `Task.startedAt` / `endedAt`, set by "I'm on it", the Now card, notification answers, WYD "I did", "now doing", and logging an outcome. A dedicated Start button comes with EX-2. |
| TA-6 | Estimated vs actual duration | Done | Actual-time chips → time multiplier, per-block estimates in Insights. |
| TA-7 | Optional overtime confirmation | Done | Focus mode: "Time's up. Need more time?" +10 / +30 / Done; extensions counted (`Task.extendedMin`). |
| TA-8 | Automatic recording of unplanned activity | Partial | Logged via WYD, quick log, or a spoken / typed day log that Claude turns into entries (approved by the user). Kept as data for insights; viewable in Me → Your log. |
| TA-9 | Notification modes: strict / adaptive / minimal | Partial | Per-type on/off switches (`NotifyPrefs`). Already adaptive: done blocks lose their halfway / end prompts, and the hourly WYD skips any hour already logged 45+ min (`loggedMinutes` in `cuesFor`). No mode switch yet. |

## Module 3 · Task execution and starting (P0)

| ID | Requirement | Status | Notes / where |
| --- | --- | --- | --- |
| EX-1 | Subtasks on any task | Partial | Steps exist for **projects** (My day tab), not for blocks. |
| EX-2 | Prominent **Start** button: record start, show first action, focus mode, timer | Done | Start on the block panel, the Now card and Up next; records the real start and a running My day entry (`lib/focus.ts`). First action shows once subtasks exist (EX-1). |
| EX-3 | 5-minute starting commitment | Done | "Just 5 minutes" → "Keep going?" or "That's enough for now" (logged as partly done, no guilt). |
| EX-4 | Focus mode: only current task, time left, next up, distraction capture, pause / finish / extend | Done | `FocusView` (full screen, minimizes to a bar); other prompts and hourly WYD stay quiet during focus; "time's up" push notification. Captured thoughts go to to-dos until the inbox (CI-5) exists. |

## Module 4 · Check-ins and execution tracking (P0)

| ID | Requirement | Status | Notes / where |
| --- | --- | --- | --- |
| CI-1 | Capture planned activity, actual activity, completion, reason, notes, energy, duration | Partial | Completion (done / partly / "if not" / not done), reason, what-instead, note, daily energy + sleep, actual duration. Planned vs actual are linked by `taskId` on log entries. |
| CI-2 | Standard reason list | Done | Distracted, hard to start, took longer than planned, low energy, something came up, avoiding it, forgot, lost track of time, overwhelmed, plus the owner's own (bloated/hungry, poor sleep) and other. Each has suggested fixes. |
| CI-3 | Attempted-but-unfinished vs never-started | Done | `startState()` from start times + outcome; Insights says when blocks are mostly never started vs dropped partway. |
| CI-4 | One-tap check-in (5–10 s); more questions only when needed | Done | `AskSheet`, `WhySheet`, `WydSheet`, notification buttons. |
| CI-5 | Distraction inbox: capture without leaving; processed later, never auto-scheduled | Partial | Quick to-do (+ button) and Work → Capture exist, but they go straight to to-dos/projects; no separate inbox to process. |

## Module 5 · Recovery engine (P0)

| ID | Requirement | Status | Notes / where |
| --- | --- | --- | --- |
| RE-1 | Recompute the rest of the day from remaining time, fixed commitments, priorities, deadlines, durations, energy, buffers | Done | `proposeRecovery` in `lib/schedule.ts` (deterministic, unit-tested). Manual tools remain: Reorganize, tray, "clear the rest of today". |
| RE-2 | Scenario handling (late start, overrun, missed gym, low energy, new appointment, too much left) | Done | All six are unit-tested. Today offers "Fix my day" (never applies it) after a 30+ min overrun, two slipped blocks, or a low-energy check-in. |
| RE-3 | **Minimum viable day** button | Done | "Minimum day" in the Fix my day panel: keeps fixed, essential and "has to happen today" blocks plus the one top task; the rest goes to the tray (routines: skipped today). |
| RE-4 | Proposal + approval UI ("Approve" / "Edit") | Done | `RecoverSheet`: before → after with a reason per change, untick any change (edit), Approve / Dismiss. |

## Module 6 · Behaviour intelligence (P1)

| ID | Requirement | Status | Notes / where |
| --- | --- | --- | --- |
| BI-1 | Planned vs completed blocks | Done | Follow-through in Insights. |
| BI-2 | Completion by category | Done | |
| BI-3 | Average starting delay | Missing | Needs TA-5. |
| BI-4 | Average task duration / estimated vs actual | Done | |
| BI-5 | Most common interruption reasons | Done | "Why things didn't happen", "Where the time went instead". |
| BI-6 | Rescheduling frequency | Partial | History is recorded (`Task.moves`: drags, edits, tray, Fix my day); the metric isn't shown yet. |
| BI-7 | Weekly consistency (not streaks) | Missing | |
| BI-8 | Pattern detection written as observations, not causes | Partial | "What the data says" covers sleep, energy, area, barriers, estimates, drift. Wording mostly avoids claiming causes. |
| BI-9 | Personal experiments with tracked results | Partial | **Playbook rules** (if-then fixes with "worked X of Y") are an early form. No proposed experiments or start/end dates. |

## Module 7 · Recurring and floating tasks (P0)

| ID | Requirement | Status | Notes / where |
| --- | --- | --- | --- |
| RF-1 | Frequency | Done | Routines (weekdays), free blocks (every N days). |
| RF-2 | Estimated duration, preferred time window, completion window, priority, flexibility, needs-appointment | Missing | Free blocks have frequency, next due, reminder time, area. |
| RF-3 | Last completed / next due | Done | `FreeItem.lastDone`, `nextDue`. |
| RF-4 | Show upcoming obligations and **suggest free slots** | Partial | Due items show on to-dos and the week; no slot suggestions. |
| RF-5 | Never auto-convert to fixed appointments | Done | |

## AI assistant (P1–P2)

| ID | Capability | Status |
| --- | --- | --- |
| AI-1 | Schedule analysis / overload warnings | Missing (deterministic version done: DP-9, DP-10) |
| AI-2 | Day recovery proposals | Missing (needs RE-1 engine) |
| AI-3 | Task decomposition | Missing |
| AI-4 | Duration estimation | Partial (deterministic multiplier exists) |
| AI-5 | Weekly pattern insights | Missing (deterministic insights exist) |
| AI-6 | Weekly planning | Missing |
| AI-7 | Recurring-task scheduling options | Missing |
| AI-8 | Natural-language planning assistant | Missing |
| AI-9 | Spoken / typed day log → structured log (owner request) | Done (needs `ANTHROPIC_API_KEY` + `log-day` deployed) |

Rules for all AI work: `AI_BEHAVIOUR.md`.

## Beyond the spec (built at the owner's request; keep)

| Feature | Where |
| --- | --- |
| Your own categories (12 defaults incl. cooking, cleaning, errands…), each with colour + emoji | `CategorySheet`, `state.categories` |
| Emoji on every block, suggested from the title | `lib/emoji.ts` |
| Ongoing blocks (no finish time) that run until ✓ | `Task.ongoing`, `completeTask` |
| One day view: hour timeline with emoji pills, times, one-tap ✓, free-time "tap to plan", ‹ Today › arrows | `Timeline.tsx`, `lib/dayLayout.ts` |
| Native-app sizing (no zoom, no sideways scroll) | `index.html`, `lib/zoom.ts`, `index.css` |
| My day tab (was Work): projects, one next step each, steps, journal, drafts, goals, quick capture | `WorkView`, `WorkSheets`, `lib/work.ts` |
| Playbook: turn a miss into an if-then fix with a reminder, scored over time | `MissSheet`, `PlaybookView` |
| "If not" fallback version for every block | `Task.ifNot`, `Routine.ifNot` |
| Morning check-in (energy, sleep) feeding patterns | `CheckinRow` in `DayView` |
| Post-it to-dos, drag onto the day | `TodoCard` |
| One-tap notification answers that never open the app | `public/sw.js`, `lib/answers.ts` |
| Installable phone app, sync, push notifications | PWA + Supabase |

## Cross-platform (spec §5)

| ID | Requirement | Status |
| --- | --- | --- |
| XP-1 | One account, synced data across desktop and mobile | Done (Supabase sync; see weaknesses in `DATA_MODEL.md`) |
| XP-2 | Desktop: planning, analytics, detailed editing | Partial (works, but the layout is phone-first; no desktop week editing) |
| XP-3 | Mobile: check-in, start task, capture in minimal taps | Partial (check-in and capture are fast; Start missing) |
