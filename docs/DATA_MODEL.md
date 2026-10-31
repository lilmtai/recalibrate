# Data model

## Today (as built)

All data is one `State` object (`src/types.ts`), stored in the browser (`localStorage["recalibrate.v1"]`) and
synced as **one JSON row per user** (`planner_state`) in Supabase. Arrays are merged by `id` on conflict
(`src/sync.ts → merge`).

| Current type | Role | Spec entity it maps to |
| --- | --- | --- |
| `Task` | A scheduled block on a date (time, duration, category, energy, "if not", outcome, reason, what-instead, check-ins, actual minutes) | **Task + ScheduleBlock + part of ExecutionLog**, all in one record |
| `Routine` | Weekly repeating block; instances are *virtual* until touched (`tasksFor`, ids `rt:<routineId>:<date>`) | Task + **RecurrenceRule** |
| `FreeItem` | Floating task that repeats every N days, with next due and reminder time | Floating Task + RecurrenceRule |
| `Note` | Post-it to-do with no time | Floating Task (and today, also the distraction inbox) |
| `Actual` | "What really happened" stretch (from block outcomes, WYD, manual) | **ExecutionLog / CheckIn** |
| `CheckIn` | Daily energy + sleep | User context on a day |
| `Rule` | If-then fix from a miss, with reminder and win/fail score | Early **Experiment** |
| `Project`, `Step`, `Page` | Work tab: projects, steps, journal / drafts / goals | (beyond spec) Project, Subtask, Note |
| `NotifyPrefs`, `dayHours` | Preferences | User |
| — | — | **Distraction**, **AIRecommendation**, schedule change history: *not modelled yet* |

Server tables: `planner_state` (the JSON row), `push_subscriptions`, `push_queue`, and **`execution_log`**
(`supabase/history.sql`): one row per "what really happened" entry, soft-deleted, unique per prompt.
Sync: `src/useHistory.ts` (network) + `src/lib/historySync.ts` / `src/lib/history.ts` (pure, tested).
Until `history.sql` is run, history stays inside `planner_state` ("blob" mode); after, the planner row leaves it out.

## Architectural weaknesses (fix before adding big features)

Status after Sprint 0: **1 fixed** (41 unit tests incl. a two-device sync simulation), **2 fixed for history**
(the log lives in `execution_log`, 60 days on the phone), **4 partly** (soft deletes; edits still overwrite),
**6 fixed** (one answer per prompt via `prompt_key`). 3 and 5 remain.


1. **No tests.** Scheduling, recurrence, stats and sync merge are pure functions with no test coverage.
   The spec requires tests for scheduling and recovery logic. → Add Vitest for `src/lib/*` first.
2. **One JSON blob per user.** Every edit re-uploads the whole state; merge is "newer copy wins per item".
   History grows without limit (`actuals`, `tasks`, `pages`), and **browser storage caps at ~5 MB**,
   which a year of hourly WYD logs will approach.
3. **Task, schedule and execution are one record.** Moving a block overwrites its time, so there is no
   history of reschedules (spec rule 4) and no way to measure rescheduling frequency (BI-6).
4. **Execution logs are editable in place.** Spec rule 3 says they're historical records, changed only by
   explicit corrections.
5. **Times are local wall-clock strings** (`"2026-10-31"`, `"14:00"`) without a time zone. Fine for one person
   in one place; wrong when travelling or across daylight-saving changes (spec rule 6).
6. **No duplicate protection for check-ins across devices** (spec rule 8): two devices answering the same WYD
   both create entries.

## Target model (relational, in Supabase)

```
user_profile        (user_id PK, time_zone, day_start, day_end, notify_mode, prefs jsonb)
category            (id, user_id, key, label, color)
task                (id, user_id, title, description, category_id, priority, energy, start_difficulty,
                     est_minutes, min_minutes, if_not, deadline, can_postpone, kind fixed|flexible|floating,
                     project_id NULL, recurrence_id NULL, status open|done|dropped, created_at)
subtask             (id, task_id, text, done, position)
recurrence_rule     (id, user_id, freq weekly|every_n_days, weekdays int[], every_days, time_window,
                     preferred_start, est_minutes, last_done, next_due)
schedule_block      (id, task_id, date, start_at timestamptz, end_at timestamptz, fixed bool,
                     created_by user|ai|recovery, replaced_by NULL)        -- moves create a new block
schedule_change     (id, block_id, from_start, to_start, reason, source user|recovery|ai, at)
execution_log       (id, user_id, block_id NULL, task_id NULL, started_at, ended_at, outcome
                     done|partial|missed|not_started, reason, instead, note, energy, source wyd|block|manual,
                     device_id, corrected_from NULL)                        -- append-only
check_in            (id, user_id, prompt_at, answered_at, device_id, log_id)  -- unique (user_id, prompt_at)
distraction         (id, user_id, text, captured_at, processed_at NULL, became_task_id NULL)
experiment          (id, user_id, hypothesis, change, starts_on, ends_on, metric, result)
ai_recommendation   (id, user_id, kind, input_snapshot jsonb, proposal jsonb, explanation,
                     status proposed|approved|edited|rejected, created_at, decided_at)
project, step, page (as today, as tables)
```

Rules (from the spec, binding for all code):
1. A task can have many schedule blocks.
2. Moving a block never changes the underlying task.
3. Execution logs are append-only; corrections are new rows pointing at the old one.
4. Every schedule change is recorded (`schedule_change`).
5. Recurring tasks generate concrete instances (blocks) for a rolling window.
6. All time math happens in the user's time zone; store `timestamptz`.
7. AI recommendations are stored separately and never applied without approval.
8. Check-ins are unique per prompt, so two devices can't double-log.

## Migration path (incremental, no big bang)

1. **Tests first** (Vitest) around `lib/plan`, `lib/stats`, `lib/actuals`, `sync.merge`.
2. **Introduce a `lib/schedule.ts` engine** that works on the current types (capacity, constraints, recovery
   proposals). Its inputs and outputs are plain data, so it moves unchanged to the new model later.
3. **Split history out of the blob:** move `actuals` (execution logs) and check-ins to their own Supabase
   tables first, append-only and keyed by prompt time, keeping only recent days in the browser. This fixes
   weaknesses 2, 4 and 6 for the fastest-growing data.
4. **Split task vs schedule block:** add `scheduleHistory` on blocks (local), then move to `task` +
   `schedule_block` + `schedule_change` tables.
5. **Time zone:** store `time_zone` in the profile; convert at the edges.
6. Keep `planner_state` only for small preferences, then retire it.

Each step ships on its own, behind migrations in `store.ts` (`migrate`) and SQL files in `supabase/`.
