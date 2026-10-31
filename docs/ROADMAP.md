# Roadmap and backlog

Order follows the spec's advice: **build the data and scheduling foundation before AI**, otherwise AI
recommends from incomplete data. Each item lists the requirement IDs it covers (`PRODUCT_REQUIREMENTS.md`)
and acceptance criteria (AC). An item is done when every AC is met, tests pass, and docs are updated.

## Sprint 0 · Foundation (do first) · ✅ done (F-5 needs `supabase/history.sql` run once)

**F-1 · Test harness for core logic**
- AC: Vitest set up (`npm test`), running in CI before deploy.
- AC: tests cover `tasksFor` (routine instances, skipped days, "every week" edits), `cuesFor` (start / mid /
  end / WYD / free timing), `stats14`, `syncActuals`, `logSame` / `wydFrom`, `freeDone`, `sync.merge`.

**F-2 · Record real start and finish** (TA-5, CI-3)
- AC: a block gets `startedAt` when the user taps Start, answers "I'm on it", or WYD logs it; `endedAt` on done.
- AC: outcomes distinguish **not started** from **started, unfinished**.

**F-3 · Reason list aligned with the spec** (CI-2)
- AC: add "Distracted", "Hard to start", "Took longer than planned", "Other"; keep the owner's existing ones.
- AC: old data keeps working (migration maps nothing away).

**F-4 · No automatic rollover** (DP-7)
- AC: unfinished to-dos from earlier days are not silently carried; Today shows "3 unfinished from before ·
  Review" → keep today / pick a day / drop, in one panel.

**F-5 · Split execution history out of the blob** (DATA_MODEL weaknesses 2, 4, 6)
- AC: `execution_log` and `check_in` Supabase tables, append-only, unique per prompt; the app writes there
  and keeps only the last 30 days locally.
- AC: answering the same WYD on two devices produces one entry.

## Sprint 1 · Planning foundation (P0)

**P-1 · Block kinds: fixed / flexible / floating** (DP-1, DP-5)
- AC: new-block form has Fixed / Flexible; floating = to-dos and free blocks.
- AC: fixed blocks show a lock; dragging one asks for confirmation.

**P-2 · More block fields, behind "More"** (DP-2)
- AC: priority (low / normal / high), deadline, starting difficulty (easy / medium / hard), minimum minutes,
  can-postpone, description. Defaults keep the form as fast as today.

**P-3 · Capacity indicator** (DP-8, DP-9)
- AC: Today shows available / planned / buffer / unallocated for the day, using day hours, fixed blocks and
  time already passed; also "realistic planned" (× personal time multiplier).

**P-4 · Overload warning** (DP-10)
- AC: when planned > available − buffer, a calm banner offers three fixes (move, shorten to minimum, postpone);
  each opens a proposal; nothing changes without approval.

**P-5 · Gap-fit and buffer rules in Reorganize and suggestions** (DP-3, DP-4)
- AC: the engine never proposes a block in a gap shorter than its duration; adds transition buffers after long
  focus blocks; unit-tested.

**P-6 · Floating tasks: duration, preferred window, slot suggestions** (RF-2, RF-4)
- AC: free blocks / to-dos can have minutes and a preferred window; "Find a time" shows 2–3 valid slots.

## Sprint 2 · Execution (P0) · E-1, E-2, E-6 done; E-3, E-4, E-5 open

**E-1 · Start button and focus mode** (EX-2, EX-4, TA-1)
- AC: every block has Start. Focus screen: task, first step, time left, next up, capture field,
  Pause / Finish / +10 min. Starting records `startedAt`.

**E-2 · 5-minute start** (EX-3)
- AC: "Just 5 minutes" option starts a 5-min timer, then asks "keep going?" (yes extends, no logs partial
  with no guilt copy).

**E-3 · Subtasks on blocks** (EX-1)
- AC: any block can have steps (same `Step` model as projects); focus mode shows the first open one.

**E-4 · Distraction inbox** (CI-5)
- AC: capture from focus mode, the + button and a notification goes to an Inbox (not the schedule);
  Inbox lists items with "→ to-do / → project / → schedule / delete".

**E-5 · Notification modes** (TA-9)
- AC: Strict / Adaptive / Minimal in settings; Adaptive skips WYD when the current hour is already logged
  or a block prompt is near.

**E-6 · Overtime check** (TA-7)
- AC: when a running block ends, "Need more time? +10 / +30 / Done" (one tap); extension is recorded.

## Sprint 3 · Recovery (P0, the differentiator)

**R-1 · Recovery engine** (RE-1, SCHEDULING_RULES → Recovery)
- AC: deterministic `proposeRecovery(day, now)` returns moves with reasons; full unit tests for the six
  scenarios (late start, overrun, missed gym, low energy, new appointment, too much left).

**R-2 · "Fix my day" proposal UI** (RE-4)
- AC: one tap → proposal card (before → after, reasons, "fixed appointments preserved") → Approve / Edit /
  Dismiss. Approve applies all moves and records them in schedule history.

**R-3 · Minimum viable day** (RE-3)
- AC: one button keeps fixed blocks, essential routines and the top-priority task; everything else becomes
  optional or postponed, as a proposal.

**R-4 · Automatic triggers** (RE-2)
- AC: offer recovery (never apply) after a 30+ min overrun, a missed check-in streak of 2, or a low-energy
  check-in.

**R-5 · Schedule change history** (BI-6, DATA_MODEL rule 4)
- AC: every move records from → to, source (user / recovery / AI), time.

## Sprint 4 · Intelligence (P1)

**I-1 · New metrics** (BI-3, BI-6, BI-7): average start delay, rescheduling frequency, weekly consistency
(active days per week, no streaks), recovery acceptance and success rates.

**I-2 · Weekly review**: a guided 5-minute review: wins, top barriers, plan vs reality per area, one
experiment to try. Plan-vs-actual comparison lives here (owner removed it from My day).

**I-3 · AI layer** (AI-1…AI-5): Edge Function + Claude API; task decomposition first, then recovery
explanations, duration estimates and weekly insights, all as proposals (`AI_BEHAVIOUR.md`).

## Sprint 5 · Personalisation (P2)

**X-1 · Experiments** (BI-9): grow Playbook rules into experiments with a hypothesis, start/end and result.
**X-2 · Energy matching**: suggest high-energy work in the user's best hours.
**X-3 · Weekly AI planning** (AI-6).
**X-4 · App Store / Play Store build** with Capacitor: on-device notifications with real action buttons on
iPhone, haptics, account deletion, privacy policy.

## Success metrics (spec §9)

| Metric | Source |
| --- | --- |
| **Disrupted days successfully recovered** (headline) | days with a recovery proposal approved and ≥ 70% of remaining planned time executed |
| Planned vs completed blocks | blocks + outcomes |
| Average start delay | `startedAt` − planned start |
| Estimated vs actual duration | actual minutes |
| Recovery acceptance / success rate | `ai_recommendation` + outcomes |
| Weekly active days | days with any log |
| Check-in completion rate | answered ÷ sent prompts |
| Overloaded days | days where planned > available − buffer |
| Usefulness | short in-app rating in the weekly review |
