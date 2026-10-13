// JournalPilot AI e2e — realistic user flows through the logic layer.
"use strict";
const JP = require("../js/logic.js");
const P = require("../js/prompts.js");

let flows = 0;
function flow(name, fn) {
  fn();
  flows++;
  console.log("E2E PASS: " + name);
}

// 1: a week of journaling builds entries, streak, and word totals
flow("week of journaling", () => {
  let e = [];
  const days = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"];
  const moods = ["good", "great", "okay", "good", "low", "good", "great"];
  days.forEach((d, i) => {
    e = JP.saveEntry(e, d, { text: "Day " + (i + 1) + " reflections on life and work", mood: moods[i] });
  });
  if (e.length !== 7) throw new Error("expected 7 entries");
  if (JP.currentStreak(e, "2026-09-28") !== 7) throw new Error("expected 7-day streak");
  if (JP.longestStreak(e) !== 7) throw new Error("expected longest 7");
  if (JP.totalWords(e) <= 0) throw new Error("no words counted");
});

// 2: overwriting today's entry keeps a single entry per date
flow("overwrite same date", () => {
  let e = JP.saveEntry([], "2026-09-28", { text: "morning draft" });
  e = JP.saveEntry(e, "2026-09-28", { text: "evening final version" });
  if (e.length !== 1) throw new Error("duplicate date entries");
  if (JP.getEntry(e, "2026-09-28").text !== "evening final version") throw new Error("not overwritten");
});

// 3: search across a month of entries
flow("search month of entries", () => {
  let e = [];
  for (let i = 1; i <= 20; i++) {
    const d = "2026-09-" + String(i).padStart(2, "0");
    e = JP.saveEntry(e, d, { text: i === 13 ? "Beach day with family" : "ordinary day " + i });
  }
  const r = JP.searchEntries(e, "beach");
  if (r.length !== 1 || r[0].date !== "2026-09-13") throw new Error("search missed");
  if (JP.searchEntries(e, "zzz-no-match").length !== 0) throw new Error("false positive");
});

// 4: mood insights reflect the month
flow("mood insights", () => {
  let e = [];
  const plan = [["2026-09-01", "great"], ["2026-09-02", "great"], ["2026-09-03", "rough"]];
  plan.forEach(([d, m]) => { e = JP.saveEntry(e, d, { text: "entry " + d, mood: m }); });
  const c = JP.moodCounts(e);
  if (c.great !== 2 || c.rough !== 1) throw new Error("mood counts wrong: " + JSON.stringify(c));
});

// 5: deleting an entry breaks the streak honestly
flow("delete breaks streak", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-09-28", { text: "a" });
  e = JP.saveEntry(e, "2026-09-27", { text: "b" });
  e = JP.deleteEntry(e, "2026-09-27");
  if (JP.currentStreak(e, "2026-09-28") !== 1) throw new Error("streak should be 1 after delete");
});

// 6: every day of the year gets a valid prompt
flow("prompt coverage for a year", () => {
  for (let m = 1; m <= 12; m++) {
    for (const day of [1, 15, 28]) {
      const d = "2026-" + String(m).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      const p = JP.promptForDate(d);
      if (!P.CATEGORIES.includes(p.category)) throw new Error("bad category for " + d);
      if (!P.PROMPTS[p.category].includes(p.text)) throw new Error("prompt not in bank for " + d);
    }
  }
});

// 7: default prompt is stored with the entry
flow("entry stores its prompt", () => {
  const e = JP.saveEntry([], "2026-09-28", { text: "some thoughts" });
  const got = JP.getEntry(e, "2026-09-28");
  const expected = JP.promptForDate("2026-09-28");
  if (!got.prompt || got.prompt.text !== expected.text) throw new Error("prompt not stored");
});

// 8: export a month of entries to markdown and verify structure
flow("markdown export of a month", () => {
  let e = [];
  const days = ["2026-10-01", "2026-10-02", "2026-10-03"];
  const texts = ["Started the garden #garden", "Rainy day, read #reading", "Harvested tomatoes #garden"];
  days.forEach((d, i) => { e = JP.saveEntry(e, d, { text: texts[i], mood: ["good", "okay", "great"][i] }); });
  const md = JP.entriesToMarkdown(e);
  const lines = md.split("\n");
  if (lines[0] !== "# Journal Export") throw new Error("title line");
  if (!/3 entries/.test(lines[2])) throw new Error("count line: " + lines[2]);
  const h1 = md.indexOf("## 2026-10-01"), h3 = md.indexOf("## 2026-10-03");
  if (h1 === -1 || h3 === -1 || h1 > h3) throw new Error("sections oldest-first");
  if (!md.includes("> ")) throw new Error("prompts should be blockquoted");
  if (!md.includes("#garden")) throw new Error("tags preserved in export");
});

// 9: tag journey — write tagged entries, aggregate, filter
flow("tag journey", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-10-01", { text: "Gym #fitness #health" });
  e = JP.saveEntry(e, "2026-10-02", { text: "Run #fitness" });
  e = JP.saveEntry(e, "2026-10-03", { text: "Meditate #health" });
  const tags = JP.entryTags(e);
  if (tags.length !== 2) throw new Error("want 2 tags, got " + tags.length);
  const fit = tags.find(t => t.tag === "fitness");
  if (!fit || fit.count !== 2) throw new Error("fitness count");
  const filtered = JP.entriesWithTag(e, "health");
  if (filtered.length !== 2) throw new Error("health filter");
  // tags survive a save/load round trip
  JP.persistEntries(e);
  const reloaded = JP.loadEntries();
  if (JP.entryTags(reloaded).length !== 2) throw new Error("tags lost after reload");
});

// 10: word goal journey — write toward a goal, verify progress
flow("word goal journey", () => {
  let e = [];
  const words = Array(120).fill("word").join(" ");
  e = JP.saveEntry(e, "2026-10-08", { text: words, mood: "good" });
  const gp = JP.goalProgress(JP.wordCount(JP.getEntry(e, "2026-10-08").text), 200);
  if (gp.words !== 120 || gp.pct !== 60 || gp.met) throw new Error("progress " + JSON.stringify(gp));
  const met = JP.goalProgress(200, 200);
  if (!met.met || met.pct !== 100) throw new Error("met goal");
});

// 11: on-this-day + calendar over a multi-year journal
flow("on this day across years", () => {
  let e = [];
  e = JP.saveEntry(e, "2024-10-08", { text: "first october entry", mood: "good" });
  e = JP.saveEntry(e, "2025-10-08", { text: "second october entry", mood: "great" });
  e = JP.saveEntry(e, "2026-10-07", { text: "yesterday", mood: "okay" });
  const otd = JP.onThisDay(e, "2026-10-08");
  if (otd.length !== 2 || otd[0].text !== "first october entry") throw new Error("on-this-day wrong");
  const oct = JP.monthDays(e, 2026, 10);
  const marked = oct.filter(d => d.hasEntry);
  if (marked.length !== 1 || marked[0].date !== "2026-10-07") throw new Error("calendar marks wrong days");
  const leap = JP.monthDays([], 2024, 2);
  const feb29 = leap.find(d => d.date === "2024-02-29");
  if (!feb29 || !feb29.inMonth) throw new Error("leap day missing from grid");
});

// 12: monthly recap journey — a full October tells its story
flow("monthly recap journey", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-10-01", { text: "Started the new quarter with energy #goals", mood: "great" });
  e = JP.saveEntry(e, "2026-10-02", { text: "Long meeting day, drained by evening #work", mood: "low" });
  e = JP.saveEntry(e, "2026-10-03", { text: "Quiet Saturday reset #goals", mood: "good" });
  e = JP.saveEntry(e, "2026-11-01", { text: "November begins", mood: "okay" });
  const r = JP.monthlyRecap(e, 2026, 10);
  if (r.entries !== 3) throw new Error("recap entries");
  if (r.topTags[0].tag !== "goals" || r.topTags[0].count !== 2) throw new Error("recap tags");
  if (r.longestEntry.date !== "2026-10-02") throw new Error("recap longest (tie -> most recent)");
});

// 13: mood trend journey — a rough week shows up in the trend
flow("mood trend journey", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-10-05", { text: "rough start to the week", mood: "rough" });
  e = JP.saveEntry(e, "2026-10-06", { text: "still rough", mood: "rough" });
  e = JP.saveEntry(e, "2026-10-12", { text: "better week great", mood: "great" });
  const t = JP.moodTrend(e, 2, "2026-10-12");
  if (t[0].avg !== 1) throw new Error("rough week avg should be 1, got " + t[0].avg);
  if (t[1].avg !== 5) throw new Error("recovery week avg should be 5, got " + t[1].avg);
});

// 14: filtered export journey — export just one tag's story
flow("filtered export journey", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-10-01", { text: "Morning run, feeling strong #fitness", mood: "great" });
  e = JP.saveEntry(e, "2026-10-02", { text: "Rest day, sore legs #fitness", mood: "okay" });
  e = JP.saveEntry(e, "2026-10-03", { text: "Work presentation went well", mood: "good" });
  const md = JP.entriesToMarkdown(e, { tag: "fitness" });
  const sections = md.split("\n## ").length - 1;
  if (sections !== 2) throw new Error("tag export should have 2 entries, got " + sections);
  if (/presentation/.test(md)) throw new Error("untagged entry leaked into export");
});

// 15: year in review journey — a full year of journaling summarizes honestly
flow("year in review journey", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-01-02", { text: "new year fresh start", mood: "great" });
  e = JP.saveEntry(e, "2026-01-03", { text: "still going strong here", mood: "good" });
  e = JP.saveEntry(e, "2026-06-15", { text: "midyear check in #goals", mood: "okay" });
  const r = JP.yearlyRecap(e, 2026);
  if (r.entries !== 3) throw new Error("entries");
  if (r.monthsWritten !== 2) throw new Error("months written");
  if (r.bestMonth !== "2026-01") throw new Error("best month");
  if (r.longestStreak !== 2) throw new Error("year streak");
  if (r.topTags[0].tag !== "goals") throw new Error("year tags");
  if (JP.yearlyRecap(e, 2025).entries !== 0) throw new Error("other year empty");
});

// 16: mood x words journey — long entries land on good days
flow("mood x words journey", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-10-01", { text: "wonderful long wonderful entry today yes", mood: "great" });
  e = JP.saveEntry(e, "2026-10-02", { text: "bleh", mood: "rough" });
  const w = JP.wordsByMood(e);
  const great = w.find((r) => r.mood === "great");
  const rough = w.find((r) => r.mood === "rough");
  if (great.avgWords !== 6 || rough.avgWords !== 1) throw new Error("averages wrong");
});

// 17: backup journey — full restore from a JSON backup
flow("backup and restore journey", () => {
  let e = [];
  e = JP.saveEntry(e, "2026-10-01", { text: "first entry #start", mood: "good" });
  e = JP.saveEntry(e, "2026-10-02", { text: "second entry", mood: "great" });
  const json = JP.exportBackup(e, 250);
  const res = JP.importBackup(json);
  if (res.entries.length !== 2) throw new Error("restore count");
  if (res.entries[0].date !== "2026-10-02") throw new Error("newest-first order lost");
  if (res.entries[1].text !== "first entry #start") throw new Error("text lost");
  if (res.wordGoal !== 250) throw new Error("goal lost");
});

console.log("All " + flows + " e2e flows passed.");
