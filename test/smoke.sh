#!/usr/bin/env bash
# JournalPilot AI smoke tests — fast sanity checks. Exit non-zero on first failure.
set -euo pipefail
cd "$(dirname "$0")/.."

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# 1: required files exist
for f in index.html css/style.css js/prompts.js js/logic.js js/app.js README.md test/e2e.sh test/run-e2e.js; do
  [ -f "$f" ] || fail "missing file $f"
done
pass "all required files exist"

# 2: JS syntax valid
for f in js/prompts.js js/logic.js js/app.js test/run-e2e.js; do
  node --check "$f" || fail "syntax error in $f"
done
pass "JS syntax valid"

# 3: prompt bank has 100+ prompts across 6 categories
count=$(node -e "const P=require('./js/prompts.js'); console.log(P.promptCount())")
[ "$count" -ge 100 ] || fail "prompt bank too small: $count"
pass "prompt bank has $count prompts (>=100)"

# 4: all 6 categories non-empty, every prompt a non-empty string
node -e "
const P = require('./js/prompts.js');
if (P.CATEGORIES.length !== 6) throw new Error('expected 6 categories');
P.CATEGORIES.forEach(c => {
  const bank = P.PROMPTS[c];
  if (!Array.isArray(bank) || !bank.length) throw new Error('empty category ' + c);
  bank.forEach(p => { if (typeof p !== 'string' || !p.trim()) throw new Error('bad prompt in ' + c); });
});
console.log('OK');
" || fail "prompt bank schema"
pass "6 categories non-empty, all prompts valid strings"

# 5: prompt of the day is deterministic
node -e "
const JP = require('./js/logic.js');
const a = JP.promptForDate('2026-09-28');
const b = JP.promptForDate('2026-09-28');
if (a.category !== b.category || a.text !== b.text) throw new Error('not deterministic');
if (!a.text || !a.category) throw new Error('empty prompt');
console.log('OK: ' + a.category);
" || fail "prompt determinism"
pass "promptForDate is deterministic per date"

# 6: prompts vary across days
node -e "
const JP = require('./js/logic.js');
const seen = new Set();
for (let i = 0; i < 30; i++) {
  const d = '2026-09-' + String(i + 1).padStart(2, '0');
  seen.add(JP.promptForDate(d).text);
}
if (seen.size < 10) throw new Error('too little variety: ' + seen.size);
console.log('OK: ' + seen.size + ' distinct prompts over 30 days');
" || fail "prompt variety"
pass "prompts vary across days"

# 7: save + get entry roundtrip
node -e "
const JP = require('./js/logic.js');
let e = JP.saveEntry([], '2026-09-28', { text: 'Hello world', mood: 'good' });
const got = JP.getEntry(e, '2026-09-28');
if (!got || got.text !== 'Hello world' || got.mood !== 'good') throw new Error('roundtrip failed');
console.log('OK');
" || fail "save/get roundtrip"
pass "saveEntry/getEntry roundtrip works"

# 8: empty text rejected
node -e "
const JP = require('./js/logic.js');
try { JP.saveEntry([], '2026-09-28', { text: '   ' }); throw new Error('should have thrown'); }
catch (err) { if (!/empty/.test(err.message)) throw err; }
console.log('OK');
" || fail "empty text validation"
pass "empty entry text is rejected"

# 9: bad mood rejected
node -e "
const JP = require('./js/logic.js');
try { JP.saveEntry([], '2026-09-28', { text: 'x', mood: 'ecstatic' }); throw new Error('should have thrown'); }
catch (err) { if (!/mood/.test(err.message)) throw err; }
console.log('OK');
" || fail "mood validation"
pass "invalid mood is rejected"

# 10: streak = 3 for three consecutive days
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-09-28', { text: 'a' });
e = JP.saveEntry(e, '2026-09-27', { text: 'b' });
e = JP.saveEntry(e, '2026-09-26', { text: 'c' });
const s = JP.currentStreak(e, '2026-09-28');
if (s !== 3) throw new Error('expected 3, got ' + s);
console.log('OK');
" || fail "streak consecutive"
pass "streak = 3 for three consecutive days"

# 11: streak tolerates today unwritten (counts from yesterday)
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-09-27', { text: 'b' });
e = JP.saveEntry(e, '2026-09-26', { text: 'c' });
const s = JP.currentStreak(e, '2026-09-28');
if (s !== 2) throw new Error('expected 2, got ' + s);
console.log('OK');
" || fail "streak without today"
pass "streak counts from yesterday when today is unwritten"

# 12: gap breaks the streak
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-09-28', { text: 'a' });
e = JP.saveEntry(e, '2026-09-26', { text: 'c' });
const s = JP.currentStreak(e, '2026-09-28');
if (s !== 1) throw new Error('expected 1, got ' + s);
console.log('OK');
" || fail "streak gap"
pass "streak resets after a missed day"

# 13: search is case-insensitive and covers prompts
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-09-28', { text: 'Went HIKING in the hills' });
e = JP.saveEntry(e, '2026-09-27', { text: 'Quiet day', prompt: { category: 'gratitude', text: 'What made you smile?' } });
const r1 = JP.searchEntries(e, 'hiking');
const r2 = JP.searchEntries(e, 'SMILE');
if (r1.length !== 1 || r2.length !== 1) throw new Error('search failed');
console.log('OK');
" || fail "search"
pass "search is case-insensitive, covers text and prompts"

# 14: mood counts sum correctly
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-09-28', { text: 'a', mood: 'great' });
e = JP.saveEntry(e, '2026-09-27', { text: 'b', mood: 'great' });
e = JP.saveEntry(e, '2026-09-26', { text: 'c', mood: 'low' });
const c = JP.moodCounts(e);
if (c.great !== 2 || c.low !== 1 || c.good !== 0) throw new Error(JSON.stringify(c));
console.log('OK');
" || fail "mood counts"
pass "moodCounts tallies correctly"

# 15: deleteEntry removes the entry
node -e "
const JP = require('./js/logic.js');
let e = JP.saveEntry([], '2026-09-28', { text: 'a' });
e = JP.deleteEntry(e, '2026-09-28');
if (e.length !== 0) throw new Error('not deleted');
console.log('OK');
" || fail "delete"
pass "deleteEntry removes the entry"

# premium design bar: no gradients, system font stack, responsive
! grep -qi "gradient" css/style.css || fail "gradient found in CSS"
pass "no gradients in CSS"
grep -q "BlinkMacSystemFont" css/style.css || fail "system font stack missing"
pass "system font stack present"
grep -q "@media" css/style.css || fail "no responsive @media rules"
pass "responsive @media present"
! grep -q 'class="brand">[^<]*[📓✍️📚📊]' index.html || fail "emoji in brand header"
pass "no emoji in brand header"

# 16: markdown export — oldest first, mood + prompt included
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-09-28', { text: 'second', mood: 'good' });
e = JP.saveEntry(e, '2026-09-26', { text: 'first', mood: 'great' });
const md = JP.entriesToMarkdown(e);
if (!/^# Journal Export/.test(md)) throw new Error('missing title');
if (md.indexOf('## 2026-09-26') > md.indexOf('## 2026-09-28')) throw new Error('not oldest-first');
if (!/Great/.test(md) || !/second/.test(md)) throw new Error('missing mood/text');
console.log('OK');
" || fail "markdown export"
pass "entriesToMarkdown exports oldest-first with moods"

# 17: word goal progress math
node -e "
const JP = require('./js/logic.js');
if (JP.DEFAULT_WORD_GOAL !== 200) throw new Error('default goal');
const g1 = JP.goalProgress(50, 200);
if (g1.pct !== 25 || g1.met) throw new Error('pct ' + JSON.stringify(g1));
const g2 = JP.goalProgress(250, 200);
if (g2.pct !== 100 || !g2.met) throw new Error('cap ' + JSON.stringify(g2));
const g3 = JP.goalProgress(10, 0);
if (g3.goal !== 200) throw new Error('bad goal fallback');
console.log('OK');
" || fail "word goal progress"
pass "goalProgress: pct capped at 100, met flag, bad-goal fallback"

# 18: hashtag extraction + tag aggregation + filtering
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-09-28', { text: 'Morning run #fitness felt great #fitness' });
e = JP.saveEntry(e, '2026-09-27', { text: 'Read a book #reading' });
e = JP.saveEntry(e, '2026-09-26', { text: 'No tags here' });
if (JSON.stringify(JP.extractTags('#Ab #ab #ok-x_y #z')) !== '[\"ab\",\"ok-x_y\"]') throw new Error('extract: ' + JSON.stringify(JP.extractTags('#Ab #ab #ok-x_y #z')));
const tags = JP.entryTags(e);
if (tags.length !== 2 || tags[0].tag !== 'fitness' || tags[0].count !== 1) throw new Error('entryTags: ' + JSON.stringify(tags));
if (JP.entriesWithTag(e, 'fitness').length !== 1) throw new Error('filter fitness');
if (JP.entriesWithTag(e, '#READING').length !== 1) throw new Error('filter case-insensitive with #');
if (JP.entriesWithTag(e, 'nope').length !== 0) throw new Error('filter false positive');
console.log('OK');
" || fail "hashtags"
pass "hashtags: extract dedupes, counts, filters case-insensitively"

# 19: month calendar grid — 42 cells, weeks start Monday, entries marked
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2026-10-05', { text: 'x', mood: 'good' });
const days = JP.monthDays(e, 2026, 10);
if (days.length !== 42) throw new Error('want 42 cells');
// 2026-10-01 is a Thursday; grid starts Monday 2026-09-28
if (days[0].date !== '2026-09-28' || days[3].date !== '2026-10-01') throw new Error('grid start: ' + days[0].date);
const hit = days.find(d => d.date === '2026-10-05');
if (!hit.hasEntry || hit.mood !== 'good' || !hit.inMonth) throw new Error('entry cell');
if (days[0].inMonth) throw new Error('Sep day should be out-of-month');
console.log('OK');
" || fail "calendar grid"
pass "monthDays: 42-cell Monday-start grid with entry/mood flags"

# 20: on this day — same MM-DD from previous years only
node -e "
const JP = require('./js/logic.js');
let e = [];
e = JP.saveEntry(e, '2024-10-08', { text: 'two years ago' });
e = JP.saveEntry(e, '2025-10-08', { text: 'one year ago' });
e = JP.saveEntry(e, '2025-10-09', { text: 'wrong day' });
const otd = JP.onThisDay(e, '2026-10-08');
if (otd.length !== 2) throw new Error('want 2, got ' + otd.length);
if (otd[0].date !== '2024-10-08' || otd[1].date !== '2025-10-08') throw new Error('order');
if (JP.onThisDay(e, '2026-10-09').length !== 1) throw new Error('no same-day entry today');
console.log('OK');
" || fail "on this day"
pass "onThisDay returns prior years' same-date entries, oldest first"

# 21: new UI wired
for id in wordGoal goalFill goalText onThisDay exportMd tagChips calGrid calTitle calPrev calNext; do
  grep -q "id=\"$id\"" index.html || fail "index.html missing #$id"
done
pass "new UI elements present in index.html"
grep -q 'onThisDay\|goalProgress\|monthDays\|entriesToMarkdown\|extractTags' js/app.js || fail "app.js missing wiring"
pass "app.js wires goal/tags/calendar/export/on-this-day"

echo "All smoke tests passed."
