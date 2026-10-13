// JournalPilot AI — pure logic layer (browser + node compatible).
// All state lives in localStorage; no network calls, nothing leaves the browser.
(function () {
"use strict";

const P = (typeof require !== "undefined")
  ? require("./prompts.js")
  : window.JournalPrompts;

const MOODS = ["great", "good", "okay", "low", "rough"];
const MOOD_LABELS = { great: "Great", good: "Good", okay: "Okay", low: "Low", rough: "Rough" };
const MOOD_EMOJI = { great: "😄", good: "🙂", okay: "😐", low: "😟", rough: "😞" };
const MOOD_COLORS = { great: "#2f7d4f", good: "#65a30d", okay: "#d9a441", low: "#c2703d", rough: "#b91c1c" };
const STORE_KEY = "journalpilot:v1";

// ---- storage (localStorage in browser, in-memory fallback for node/tests) ----
const memFallback = {};
const storage = {
  get(k) {
    try {
      if (typeof localStorage !== "undefined") return localStorage.getItem(k);
    } catch (e) {}
    return Object.prototype.hasOwnProperty.call(memFallback, k) ? memFallback[k] : null;
  },
  set(k, v) {
    try {
      if (typeof localStorage !== "undefined") { localStorage.setItem(k, v); return; }
    } catch (e) {}
    memFallback[k] = v;
  }
};

function loadEntries() {
  try {
    const raw = storage.get(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function persistEntries(entries) {
  storage.set(STORE_KEY, JSON.stringify(entries));
}

// ---- dates ----
function todayISO(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function addDaysISO(iso, n) {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return todayISO(dt);
}

// ---- prompt of the day (deterministic per date) ----
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function promptForDate(dateISO) {
  const cats = P.CATEGORIES;
  const cat = cats[hashStr("cat:" + dateISO) % cats.length];
  const bank = P.PROMPTS[cat];
  const text = bank[hashStr("idx:" + dateISO) % bank.length];
  return { category: cat, text: text };
}

// ---- entries (pure functions over entry arrays) ----
// entry: { date: "YYYY-MM-DD", text, mood, prompt: {category, text}, updatedAt }
function getEntry(entries, dateISO) {
  return entries.find(function (e) { return e.date === dateISO; }) || null;
}

function saveEntry(entries, dateISO, data) {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error("bad date: " + dateISO);
  const text = (data.text || "").trim();
  if (!text) throw new Error("entry text is empty");
  const mood = data.mood || "okay";
  if (MOODS.indexOf(mood) === -1) throw new Error("bad mood: " + mood);
  const prompt = data.prompt || promptForDate(dateISO);
  const next = entries.filter(function (e) { return e.date !== dateISO; });
  next.push({
    date: dateISO,
    text: text,
    mood: mood,
    prompt: prompt,
    updatedAt: new Date().toISOString()
  });
  next.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  return next;
}

function deleteEntry(entries, dateISO) {
  return entries.filter(function (e) { return e.date !== dateISO; });
}

function hasEntryOn(entries, dateISO) {
  const e = getEntry(entries, dateISO);
  return !!(e && e.text && e.text.trim());
}

function currentStreak(entries, refISO) {
  const ref = refISO || todayISO();
  let streak = 0;
  // Streak counts back from today; if today has no entry yet, start from yesterday.
  let cursor = hasEntryOn(entries, ref) ? ref : addDaysISO(ref, -1);
  while (hasEntryOn(entries, cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

function longestStreak(entries) {
  const days = entries
    .filter(function (e) { return e.text && e.text.trim(); })
    .map(function (e) { return e.date; })
    .sort();
  let best = 0, run = 0, prev = null;
  days.forEach(function (d) {
    if (prev && addDaysISO(prev, 1) === d) { run++; }
    else { run = 1; }
    if (run > best) best = run;
    prev = d;
  });
  return best;
}

function searchEntries(entries, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return entries.filter(function (e) {
    return e.text.toLowerCase().indexOf(q) !== -1 ||
      (e.prompt && e.prompt.text.toLowerCase().indexOf(q) !== -1);
  });
}

function moodCounts(entries) {
  const counts = {};
  MOODS.forEach(function (m) { counts[m] = 0; });
  entries.forEach(function (e) {
    if (counts[e.mood] !== undefined) counts[e.mood]++;
  });
  return counts;
}

function wordCount(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

function totalWords(entries) {
  return entries.reduce(function (n, e) { return n + wordCount(e.text); }, 0);
}

// ---- markdown export (oldest first, one section per entry) ----
function entriesToMarkdown(entries) {
  const sorted = entries.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  const lines = ["# Journal Export", "",
    "Exported " + todayISO() + " · " + sorted.length + " entr" + (sorted.length === 1 ? "y" : "ies"), ""];
  sorted.forEach(function (e) {
    lines.push("## " + e.date + (e.mood && MOOD_LABELS[e.mood] ? " — " + MOOD_LABELS[e.mood] : ""));
    if (e.prompt && e.prompt.text) { lines.push("", "> " + e.prompt.text); }
    lines.push("", e.text, "");
  });
  return lines.join("\n").trim() + "\n";
}

// ---- daily word goal ----
const DEFAULT_WORD_GOAL = 200;
function goalProgress(words, goal) {
  const g = Number(goal) > 0 ? Math.floor(Number(goal)) : DEFAULT_WORD_GOAL;
  const w = Math.max(0, Math.floor(Number(words) || 0));
  return { words: w, goal: g, pct: Math.min(100, Math.round((w / g) * 100)), met: w >= g };
}

// ---- hashtags: #tag (2+ chars, letters/digits/_/-) ----
function extractTags(text) {
  const tags = [];
  const re = /#([a-zA-Z0-9_-]{2,})/g;
  let m;
  while ((m = re.exec(text || ""))) {
    const t = m[1].toLowerCase();
    if (tags.indexOf(t) === -1) tags.push(t);
  }
  return tags;
}

function entryTags(entries) {
  const counts = {};
  entries.forEach(function (e) {
    extractTags(e.text).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
  });
  return Object.keys(counts)
    .map(function (t) { return { tag: t, count: counts[t] }; })
    .sort(function (a, b) { return b.count - a.count || (a.tag < b.tag ? -1 : 1); });
}

function entriesWithTag(entries, tag) {
  const t = String(tag || "").toLowerCase().replace(/^#/, "");
  if (!t) return [];
  return entries.filter(function (e) { return extractTags(e.text).indexOf(t) !== -1; });
}

// ---- month calendar grid (6 rows x 7 cols, weeks start Monday) ----
function monthDays(entries, year, month) {
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const byDate = {};
  entries.forEach(function (e) { byDate[e.date] = e.mood; });
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = todayISO(d);
    days.push({
      date: iso,
      inMonth: d.getMonth() === month - 1 && d.getFullYear() === year,
      hasEntry: Object.prototype.hasOwnProperty.call(byDate, iso),
      mood: byDate[iso] || null
    });
  }
  return days;
}

// ---- on this day: same MM-DD from previous years ----
function onThisDay(entries, dateISO) {
  const md = String(dateISO || "").slice(5);
  if (!/^\d{2}-\d{2}$/.test(md)) return [];
  return entries
    .filter(function (e) { return e.date !== dateISO && e.date.slice(5) === md; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

// ---- monthly recap: "your October in review" ----
function monthlyRecap(entries, year, month) {
  const prefix = year + "-" + String(month).padStart(2, "0");
  const list = (entries || []).filter(function (e) { return e.date.slice(0, 7) === prefix; });
  const words = totalWords(list);
  const mc = moodCounts(list);
  let dominant = null, best = 0;
  MOODS.forEach(function (m) { if (mc[m] > best) { best = mc[m]; dominant = m; } });
  let longest = null;
  list.forEach(function (e) {
    const w = wordCount(e.text);
    if (!longest || w > longest.words) longest = { date: e.date, words: w };
  });
  return {
    year: year, month: month,
    entries: list.length,
    words: words,
    avgWords: list.length ? Math.round(words / list.length) : 0,
    dominantMood: dominant,
    moodCounts: mc,
    topTags: entryTags(list).slice(0, 3),
    longestEntry: longest
  };
}

// ---- mood trend: weekly average mood score (great=5 .. rough=1) ----
const MOOD_SCORES = { great: 5, good: 4, okay: 3, low: 2, rough: 1 };

function weekStartISO(iso) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return todayISO(d);
}

function moodTrend(entries, weeks, refISO) {
  const n = Math.max(1, Math.min(52, Number(weeks) || 8));
  const byDate = {};
  (entries || []).forEach(function (e) { byDate[e.date] = e.mood; });
  const start = weekStartISO(refISO || todayISO());
  const out = [];
  for (let w = n - 1; w >= 0; w--) {
    const ws = addDaysISO(start, -7 * w);
    let sum = 0, count = 0;
    for (let i = 0; i < 7; i++) {
      const mood = byDate[addDaysISO(ws, i)];
      if (mood && MOOD_SCORES[mood]) { sum += MOOD_SCORES[mood]; count++; }
    }
    out.push({
      week: ws,
      entries: count,
      avg: count ? Math.round((sum / count) * 10) / 10 : null
    });
  }
  return out;
}

// ---- yearly recap: "your 2026 in review" ----
function yearlyRecap(entries, year) {
  const prefix = String(year) + "-";
  const list = (entries || []).filter(function (e) { return e.date.slice(0, 5) === prefix; });
  const words = totalWords(list);
  const mc = moodCounts(list);
  let dominant = null, best = 0;
  MOODS.forEach(function (m) { if (mc[m] > best) { best = mc[m]; dominant = m; } });
  const byMonth = {};
  list.forEach(function (e) {
    const k = e.date.slice(0, 7);
    byMonth[k] = (byMonth[k] || 0) + 1;
  });
  let bestMonth = null;
  Object.keys(byMonth).forEach(function (k) {
    if (!bestMonth || byMonth[k] > byMonth[bestMonth]) bestMonth = k;
  });
  // Longest writing streak contained in this year.
  const dates = list.map(function (e) { return e.date; }).sort();
  let run = 0, longest = 0, prev = null;
  dates.forEach(function (d) {
    if (prev && addDaysISO(prev, 1) === d) { run++; } else { run = 1; }
    if (run > longest) longest = run;
    prev = d;
  });
  return {
    year: Number(year), entries: list.length, words: words,
    avgWords: list.length ? Math.round(words / list.length) : 0,
    dominantMood: dominant, moodCounts: mc,
    monthsWritten: Object.keys(byMonth).length,
    bestMonth: bestMonth, bestMonthEntries: bestMonth ? byMonth[bestMonth] : 0,
    topTags: entryTags(list).slice(0, 5),
    longestStreak: longest
  };
}

// ---- words by mood: do you write more on good days? ----
function wordsByMood(entries) {
  const out = {};
  MOODS.forEach(function (m) { out[m] = { mood: m, entries: 0, words: 0, avgWords: 0 }; });
  (entries || []).forEach(function (e) {
    if (!out[e.mood]) return;
    out[e.mood].entries++;
    out[e.mood].words += wordCount(e.text);
  });
  MOODS.forEach(function (m) {
    out[m].avgWords = out[m].entries ? Math.round(out[m].words / out[m].entries) : 0;
  });
  return MOODS.map(function (m) { return out[m]; });
}

// ---- JSON backup / restore: full-fidelity copy of the journal ----
function exportBackup(entries, goal) {
  return JSON.stringify({
    app: "journalpilot", version: 1,
    exportedAt: new Date().toISOString(),
    wordGoal: goal || null,
    entries: entries || []
  }, null, 2);
}

function importBackup(json) {
  let obj;
  try { obj = JSON.parse(json); } catch (e) { throw new Error("That file isn't valid JSON."); }
  const arr = Array.isArray(obj) ? obj : obj.entries;
  if (!Array.isArray(arr)) throw new Error("Backup has no entries array.");
  const clean = [];
  arr.forEach(function (e, i) {
    if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) throw new Error("Bad date on entry " + (i + 1) + ".");
    const text = String(e.text || "").trim();
    if (!text) throw new Error("Empty text on entry " + (i + 1) + ".");
    if (MOODS.indexOf(e.mood) === -1) throw new Error("Bad mood on entry " + (i + 1) + ".");
    clean.push({
      date: e.date, text: text, mood: e.mood,
      prompt: e.prompt || promptForDate(e.date),
      updatedAt: e.updatedAt || new Date().toISOString()
    });
  });
  clean.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  const goal = obj && Number(obj.wordGoal) > 0 ? Math.floor(Number(obj.wordGoal)) : null;
  return { entries: clean, wordGoal: goal };
}

// ---- filtered markdown export: entriesToMarkdown(entries, {tag, from, to}) ----
function entriesToMarkdown(entries, opts) {
  const o = opts || {};
  let list = (entries || []).slice();
  if (o.tag) list = entriesWithTag(list, o.tag);
  if (o.from) list = list.filter(function (e) { return e.date >= o.from; });
  if (o.to) list = list.filter(function (e) { return e.date <= o.to; });
  const sorted = list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  const scope = o.tag ? " tagged #" + String(o.tag).replace(/^#/, "") : "";
  const lines = ["# Journal Export" + scope, "",
    "Exported " + todayISO() + " · " + sorted.length + " entr" + (sorted.length === 1 ? "y" : "ies"), ""];
  sorted.forEach(function (e) {
    lines.push("## " + e.date + (e.mood && MOOD_LABELS[e.mood] ? " — " + MOOD_LABELS[e.mood] : ""));
    if (e.prompt && e.prompt.text) { lines.push("", "> " + e.prompt.text); }
    lines.push("", e.text, "");
  });
  return lines.join("\n").trim() + "\n";
}

function relativeDay(dateISO, refISO) {
  const t = todayISO();
  const ref = refISO || t;
  const d1 = new Date(ref.slice(0, 4), ref.slice(5, 7) - 1, ref.slice(8, 10));
  const d2 = new Date(dateISO.slice(0, 4), dateISO.slice(5, 7) - 1, dateISO.slice(8, 10));
  const days = Math.round((d1 - d2) / 864e5);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return days + " days ago";
  if (days < 30) return Math.floor(days / 7) + " wk ago";
  if (days < 365) return Math.floor(days / 30) + " mo ago";
  return Math.floor(days / 365) + " yr ago";
}

function prettyDate(dateISO) {
  const d = new Date(dateISO.slice(0, 4), dateISO.slice(5, 7) - 1, dateISO.slice(8, 10));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const api = {
  MOODS: MOODS, MOOD_LABELS: MOOD_LABELS, MOOD_EMOJI: MOOD_EMOJI, MOOD_COLORS: MOOD_COLORS,
  relativeDay: relativeDay, prettyDate: prettyDate,
  MOOD_SCORES: MOOD_SCORES,
  loadEntries: loadEntries, persistEntries: persistEntries,
  todayISO: todayISO, addDaysISO: addDaysISO, weekStartISO: weekStartISO,
  promptForDate: promptForDate,
  getEntry: getEntry, saveEntry: saveEntry, deleteEntry: deleteEntry,
  hasEntryOn: hasEntryOn, currentStreak: currentStreak, longestStreak: longestStreak,
  searchEntries: searchEntries, moodCounts: moodCounts,
  moodTrend: moodTrend, monthlyRecap: monthlyRecap, yearlyRecap: yearlyRecap,
  wordsByMood: wordsByMood, exportBackup: exportBackup, importBackup: importBackup,
  wordCount: wordCount, totalWords: totalWords,
  entriesToMarkdown: entriesToMarkdown,
  DEFAULT_WORD_GOAL: DEFAULT_WORD_GOAL, goalProgress: goalProgress,
  extractTags: extractTags, entryTags: entryTags, entriesWithTag: entriesWithTag,
  monthDays: monthDays, onThisDay: onThisDay
};

if (typeof window !== "undefined") window.JournalPilot = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
