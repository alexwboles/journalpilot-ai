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

const api = {
  MOODS: MOODS, MOOD_LABELS: MOOD_LABELS, MOOD_EMOJI: MOOD_EMOJI,
  loadEntries: loadEntries, persistEntries: persistEntries,
  todayISO: todayISO, addDaysISO: addDaysISO,
  promptForDate: promptForDate,
  getEntry: getEntry, saveEntry: saveEntry, deleteEntry: deleteEntry,
  hasEntryOn: hasEntryOn, currentStreak: currentStreak, longestStreak: longestStreak,
  searchEntries: searchEntries, moodCounts: moodCounts,
  wordCount: wordCount, totalWords: totalWords
};

if (typeof window !== "undefined") window.JournalPilot = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
