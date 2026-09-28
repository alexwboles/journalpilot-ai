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

console.log("All " + flows + " e2e flows passed.");
