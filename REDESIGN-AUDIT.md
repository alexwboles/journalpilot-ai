# Redesign Audit — journalpilot-ai (2026-10-13)

**Competitors studied:** Day One (clean daily entries, calendar view, "On this day", streaks), Journey (prompt library, mood tracking, insights dashboard), Diaro (tags, search).

## Visual gaps
1. **Today view lacks a dateline.** Day One opens each entry with a proper date masthead. Ours says "Today's entry". → serif dateline masthead: weekday, month day, day-of-year.
2. **Entry cards show raw ISO dates.** → human dates + relative "3 days ago" labels.
3. **Streak bar is a thin line.** Keep — it's subtle; fine.

## Functional / flow gaps
1. **Dateline masthead** (UI, Date API).
2. **Relative date labels** on entry cards (UI, existing dates).

## Decisions
- Keep: daily prompts (shuffle/reset), mood selector, word goal, on-this-day, tags, search, Markdown export, full insights (mood bars/trend, month/year recaps, calendar), backup/restore.
- Identity: "the leather-bound diary" (already) — terracotta on cream, Fraunces serif, mood dots. Refine, don't replace.
