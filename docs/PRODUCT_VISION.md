# Product vision

Recalibrate is a personal execution system for people with ADHD. It helps turn intentions into action,
keep time realistic, recover from disrupted days, and slowly understand your own behaviour.

**Strategic decision:** optimise for *actual execution*, not planned productivity.
A normal planner measures how much you intend to do. Recalibrate measures the gap between intention and
reality, learns why it exists, and helps you shrink it.

## The four problems we design for
1. **Time blindness:** time passing is invisible.
2. **Overplanning:** days are packed beyond what's possible.
3. **Inconsistent execution:** good days and lost days alternate.
4. **Difficulty starting:** the hardest minute is the first one.

## Principles

| Principle | What it means in the product |
| --- | --- |
| Recovery over perfection | Never punish missed tasks or broken streaks. |
| Realistic planning | Protect buffers; limit daily commitments to real capacity. |
| Low interaction friction | Check-ins take seconds; one tap wherever possible. |
| Action over intention | Measure what actually happened. |
| Flexible structure | Rescheduling is effortless. |
| Personal learning | Adapt to *your* observed behaviour, not generic advice. |
| User autonomy | AI and automation suggest; you decide. |

## Decisions locked in
- **No punitive streaks.** Consistency is measured over weeks, not as an unbroken chain.
- **No automatic rollover of scheduled work.** Unfinished blocks are reconsidered, never silently moved.
- **No AI autonomy by default.** Every AI change is a proposal with an explanation and an approve step.
- **No excessive notifications.** Notification modes (strict / adaptive / minimal) let you choose.
- **No overcomplicated task management.** The everyday path stays one or two taps.
- **Privacy first.** Execution history is private, synced only to your own account, and deletable.

## Owner decisions already made in use (they refine the spec)
- **"My day" shows only what really happened.** The owner asked to remove the side-by-side plan vs. real timeline.
  Plan-vs-actual comparison still matters, but it lives in **analytics** (Insights, weekly review), not as a second timeline.
  The data model keeps both (scheduled blocks + execution logs), so nothing is lost.
- **Hourly "What are you doing?" (WYD)** is the main way real days get logged.
- **Logging a reason is optional and one tap.** Details come after, never required.
- **Work tab** for projects, next steps, journal, drafts and goals is part of the product.
- **Look:** Champagne palette (ivory, navy, champagne gold), calm and premium; see `UX_PRINCIPLES.md`.

## How we know it works
See `ROADMAP.md` → Success metrics. The headline metric:
**the share of disrupted days that were successfully recovered.**
