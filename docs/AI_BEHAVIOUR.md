# AI behaviour

AI is an **advisor, not a boss**. It is built into the workflow (planning, recovery, weekly review),
not a chatbot in a corner. This file governs every AI feature. Built so far: the **voice / text day log** (below).

## Where it runs
- Calls go through a **Supabase Edge Function** (server side) using the Claude API. The API key never
  reaches the browser or the repo.
- The function receives only the data the feature needs (today's blocks, recent history summary), not the
  whole account.

## What AI may do
- Read tasks, schedule and execution history (for the signed-in user only).
- Analyse schedule constraints *using the deterministic engine's output* (capacity, gaps, rules).
- Suggest changes, draft schedules, break tasks into steps, estimate durations, write weekly insights.
- Explain every recommendation in one or two plain sentences.

## What AI may never do silently
- Delete tasks.
- Move fixed appointments.
- Change deadlines.
- Discard unfinished work.
- Modify an approved schedule.

## Proposal flow (required for every AI change)
1. The deterministic engine computes the facts (available time, gaps, constraints).
2. AI proposes an arrangement **within those constraints** (or picks between engine-generated options).
3. The engine **validates** the proposal; anything that breaks a hard rule is rejected before the user sees it.
4. The user sees: summary, each change (before → after), the reason, and **Approve / Edit / Dismiss**.
5. The proposal and the decision are stored (`ai_recommendation`), approved or not.

Never rely on the language model for calendar arithmetic (durations, overlaps, time zones).

## Built: "Tell me about your day" (voice / text day log)
- Where: + menu → "Tell me about your day", and Me → Your log → "Tell it". Speech-to-text is the phone's own
  (keyboard mic, or the browser's speech recognition where available); only the text is sent.
- Server: Edge Function `supabase/functions/log-day/index.ts` (signed-in users only; secret `ANTHROPIC_API_KEY`).
  Claude (`claude-opus-5-5`, effort low, structured output with a JSON schema, refusal fallback on) gets the text,
  the day's plan (ids, titles, times, status), and the category / reason / instead key lists. It returns blocks
  (done / partly / missed / "if not", minutes, reason), other entries with times, energy, sleep, to-dos and a
  one-line summary.
- App: `lib/voice.ts` (pure, tested) checks every item against the real plan and lists (unknown ids, keys or
  times are dropped, blocks already logged are never overwritten), shows a tick list, and saves only what the
  user approves (`applyVoice`, same rules as the log panel).
- Not stored yet: the proposal itself (`ai_recommendation`) — add with the AI settings switch.

## Capabilities (in build order)
| Capability | Trigger | Output |
| --- | --- | --- |
| Task decomposition | Creating a big task / project step | 3–7 small first steps, the first one under 5 minutes |
| Recovery explanation | Recovery proposal from the engine | Plain-language "why this plan" |
| Duration estimate | Scheduling a task | Realistic minutes from personal history + task text |
| Weekly review | Start of week | 3 observations (not causes), 1 suggested experiment |
| Weekly planning draft | User asks | A draft week the user edits |
| Recurring task slots | Due floating task | 2–3 suggested slots |
| Planning assistant | User request | Natural-language suggestions, always as proposals |

## Tone
Warm, brief, never judgemental. Observations, not diagnoses: "You often start the first work block late"
not "You procrastinate". Suggest experiments rather than rules.

## Privacy
- Execution history is personal and sensitive. Send the minimum; don't log prompts with user content.
- The user can turn AI off entirely in Me → settings.
