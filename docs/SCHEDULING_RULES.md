# Scheduling rules

The scheduling engine is **deterministic** code (`src/lib/schedule.ts`, to be built), separate from any AI.
It enforces the rules below. AI may only propose arrangements *within* these rules (see `AI_BEHAVIOUR.md`).
Every rule here needs a unit test.

## Definitions
- **Day window:** from the user's usual start to wind-down (`dayHours`, default 07:00–23:00).
- **Available time:** the day window minus fixed commitments minus time already passed (for today).
- **Buffer:** protected slack that isn't planned (default 15% of the day window, and 10 min after
  any high-energy or high-focus block of 60 min or more).
- **Planned time:** sum of scheduled block durations in the window.
- **Unallocated:** available − planned − buffers.

## Block kinds
| Kind | May the engine move it? | Notes |
| --- | --- | --- |
| Fixed | Never, unless the user explicitly confirms | Appointments, calls, classes |
| Flexible | Yes, within the day window and before its deadline | Default for new blocks |
| Floating | Has no time until scheduled; engine may *suggest* slots | To-dos, free blocks |

## Hard constraints (never violated)
1. Fixed blocks keep their time.
2. A block only goes into a gap at least as long as its duration (or its minimum duration, if the user
   accepts the short version).
3. No block is placed outside the day window unless the user puts it there.
4. Deadlines are respected: a block is never proposed after its deadline.
5. Blocks don't overlap in a proposal (manual overlaps by the user are allowed and shown side by side).
6. Routine instances are never deleted by the engine; they can be skipped for a day with the user's approval.
7. Nothing is moved to another day without an explicit approve step (no automatic rollover).

## Soft preferences (used to rank proposals)
1. Higher priority first; then nearer deadline.
2. High-energy tasks in the user's best-performing hours (from history), low-energy ones when energy is low.
3. Keep transition buffers around long focus blocks.
4. Prefer the "if not" / minimum version over dropping a task.
5. Fewer moves are better than more moves.

## Capacity and overload
- Show **available / planned / buffer / unallocated** for the selected day.
- **Overload warning** when planned > available − buffer. Offer: move flexible blocks, shorten to minimum
  versions, or postpone low-priority ones. Never act without approval.
- Use the personal **time multiplier** (actual ÷ planned, from history) to show "realistic planned time".

## Recovery
Trigger: user taps "I'm behind" / "Fix my day", a block overruns, a check-in shows the plan slipped, or
low energy is reported.

Algorithm (deterministic):
1. Freeze: fixed blocks, completed blocks, the current running block.
2. Collect remaining flexible blocks; sort by priority, deadline, then original order.
3. Greedy-fit into remaining gaps from now, respecting hard constraints and buffers.
4. Whatever doesn't fit: offer the minimum version, then "postpone to …" (next free slot on a later day),
   or "drop for today".
5. Output a **proposal** (list of moves with before → after and a one-line reason each). Apply only on approve.

**Minimum viable day:** keep fixed blocks, essential personal care (routines tagged essential: meals, meds,
sleep prep), and the single highest-priority task; everything else becomes optional or postponed.

## Recurring tasks
- Weekly routines generate instances for a rolling window; editing asks "this day only / every week".
- Every-N-days tasks (free blocks) become due on `nextDue`; done moves `nextDue` forward by N days from the
  completion date; "tomorrow" snoozes one day.
- The engine may suggest 2–3 free slots for a due floating task that fit its duration and preferred window.
