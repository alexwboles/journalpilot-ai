# JournalPilot AI 📓

A private daily journal with a fresh writing prompt every day. Each morning you get a deterministic prompt drawn from a bank of **102 prompts** across gratitude, reflection, goals, creativity, relationships, and self-care — plus mood tagging, streak tracking, full-text search, and mood insights.

**100% local & private by design.** No account, no API keys, no network calls. Every entry lives only in your browser's localStorage — nothing is uploaded, synced, or sent anywhere.

## Run it

Just open `index.html` in any browser. Or serve it:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Features

- **Daily prompt, deterministic** — the same date always shows the same prompt (rotates across 6 categories); 🔀 shuffle for a different one
- **Day navigation** — write for today or backfill any past date
- **Mood tags** — great / good / okay / low / rough per entry
- **Streaks** — current streak (tolerates today being unwritten) + longest streak
- **Search** — case-insensitive search across entry text and prompts
- **Insights** — entry/word counts and mood distribution bars
- **Calendar** — month grid with mood-colored dots; click a day to open it
- **Word goal** — set a daily word target and watch the progress bar fill as you write
- **#Tags** — hashtag your entries; filter the whole journal by tag
- **On this day** — entries from the same date in past years, right under today's entry
- **Export** — download the whole journal as Markdown
- **Edit & delete** — reopen any entry to revise it

## Tests

```bash
bash test/smoke.sh   # fast sanity checks (15 tests)
bash test/e2e.sh     # realistic user flows (7 flows)
```

## Tech

Single-page static HTML/CSS/JS. `js/prompts.js` holds the prompt bank, `js/logic.js` is the pure UMD logic layer (shared browser/node), `js/app.js` is the DOM glue.

## License

MIT
