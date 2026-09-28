/* JournalPilot AI — DOM glue. Depends on window.JournalPilot and window.JournalPrompts. */
(function () {
"use strict";

const JP = window.JournalPilot;
const PR = window.JournalPrompts;

let entries = JP.loadEntries();
let viewingDate = JP.todayISO();
let currentTab = "today";

function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function refresh() {
  JP.persistEntries(entries);
  renderStreak();
  if (currentTab === "today") renderToday();
  else if (currentTab === "entries") renderEntries();
  else renderInsights();
}

function renderStreak() {
  const s = JP.currentStreak(entries);
  const best = JP.longestStreak(entries);
  el("streakLine").innerHTML =
    "<strong>" + s + "-day</strong> streak" +
    " &nbsp;·&nbsp; longest: <strong>" + best + "</strong>" +
    " &nbsp;·&nbsp; " + entries.length + " entr" + (entries.length === 1 ? "y" : "ies") +
    " &nbsp;·&nbsp; " + JP.totalWords(entries).toLocaleString() + " words";
}

function setTab(name) {
  currentTab = name;
  document.querySelectorAll(".tab").forEach(function (t) {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".pane").forEach(function (p) {
    p.classList.toggle("active", p.id === "pane-" + name);
  });
  refresh();
}

function renderToday() {
  const date = viewingDate;
  const prompt = JP.promptForDate(date);
  const existing = JP.getEntry(entries, date);
  const isToday = date === JP.todayISO();

  el("todayTitle").textContent = isToday ? "Today's entry" : "Entry — " + date;
  el("promptCat").textContent = PR.CATEGORY_LABELS[prompt.category];
  el("promptText").textContent = "“" + prompt.text + "”";
  el("promptText").dataset.cat = prompt.category;
  el("entryText").value = existing ? existing.text : "";
  el("entryDate").value = date;
  el("wordCount").textContent = JP.wordCount(el("entryText").value) + " words";

  document.querySelectorAll("#moodRow .mood").forEach(function (b) {
    const m = b.dataset.mood;
    b.classList.toggle("sel", existing ? existing.mood === m : m === "okay");
  });

  el("saveNote").textContent = existing
    ? "Last saved " + new Date(existing.updatedAt).toLocaleString() + "."
    : "Not written yet.";
  el("deleteBtn").style.display = existing ? "" : "none";
  el("shuffleBtn").onclick = function () { shufflePrompt(date); };
}

let shuffleSalt = 0;
function shufflePrompt(date) {
  shuffleSalt++;
  const cats = PR.CATEGORIES;
  const salted = date + "#" + shuffleSalt;
  let h = 2166136261;
  for (let i = 0; i < salted.length; i++) { h ^= salted.charCodeAt(i); h = Math.imul(h, 16777619); }
  h >>>= 0;
  const cat = cats[h % cats.length];
  const bank = PR.PROMPTS[cat];
  const text = bank[(h >> 8) % bank.length];
  el("promptCat").textContent = PR.CATEGORY_LABELS[cat] + " (shuffled)";
  el("promptText").textContent = "“" + text + "”";
  el("promptText").dataset.cat = cat;
}

function saveToday() {
  const date = el("entryDate").value || viewingDate;
  const text = el("entryText").value;
  let mood = "okay";
  document.querySelectorAll("#moodRow .mood").forEach(function (b) {
    if (b.classList.contains("sel")) mood = b.dataset.mood;
  });
  const cat = el("promptText").dataset.cat;
  const prompt = cat
    ? { category: cat, text: el("promptText").textContent.replace(/[“”]/g, "") }
    : JP.promptForDate(date);
  try {
    entries = JP.saveEntry(entries, date, { text: text, mood: mood, prompt: prompt });
    viewingDate = date;
    refresh();
    el("saveNote").textContent = "Saved ✓ " + new Date().toLocaleTimeString() + ".";
  } catch (err) {
    el("saveNote").textContent = "⚠ " + err.message;
  }
}

function renderEntries() {
  const q = el("searchBox").value || "";
  const list = q ? JP.searchEntries(entries, q) : entries.slice();
  const box = el("entryList");
  if (!list.length) {
    box.innerHTML = '<p class="muted">' + (q ? "No entries match your search." : "No entries yet. Write your first one in the Today tab.") + "</p>";
    return;
  }
  box.innerHTML = list.map(function (e) {
    return '<div class="card entry-card" data-date="' + e.date + '">' +
      '<div class="entry-head"><strong>' + e.date + "</strong>" +
      '<span class="moodtag">' + JP.MOOD_EMOJI[e.mood] + " " + JP.MOOD_LABELS[e.mood] + "</span>" +
      '<span class="pill">' + esc(PR.CATEGORY_LABELS[e.prompt.category] || e.prompt.category) + "</span></div>" +
      '<div class="entry-prompt">' + esc(e.prompt.text) + "</div>" +
      '<div class="entry-text">' + esc(e.text.length > 220 ? e.text.slice(0, 220) + "…" : e.text) + "</div>" +
      '<button class="linkbtn open-entry" data-date="' + e.date + '">Open / edit</button></div>';
  }).join("");
  box.querySelectorAll(".open-entry").forEach(function (b) {
    b.onclick = function () { viewingDate = b.dataset.date; shuffleSalt = 0; setTab("today"); };
  });
}

function renderInsights() {
  const counts = JP.moodCounts(entries);
  const max = Math.max.apply(null, JP.MOODS.map(function (m) { return counts[m]; }).concat([1]));
  el("moodBars").innerHTML = JP.MOODS.map(function (m) {
    const w = Math.round((counts[m] / max) * 100);
    return '<div class="mrow"><span class="mlabel">' + JP.MOOD_EMOJI[m] + " " + JP.MOOD_LABELS[m] +
      '</span><div class="mbar"><div class="mfill" style="width:' + w + '%"></div></div>' +
      '<span class="mcount">' + counts[m] + "</span></div>";
  }).join("");
  el("insightStats").innerHTML =
    "<div class='stat'><strong>" + entries.length + "</strong><span>entries</span></div>" +
    "<div class='stat'><strong>" + JP.totalWords(entries).toLocaleString() + "</strong><span>words</span></div>" +
    "<div class='stat'><strong>" + JP.longestStreak(entries) + "</strong><span>longest streak</span></div>" +
    "<div class='stat'><strong>" + JP.currentStreak(entries) + "</strong><span>current streak</span></div>";
}

function init() {
  document.querySelectorAll(".tab").forEach(function (t) {
    t.onclick = function () { setTab(t.dataset.tab); };
  });
  document.querySelectorAll("#moodRow .mood").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll("#moodRow .mood").forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
    };
  });
  el("saveBtn").onclick = saveToday;
  el("deleteBtn").onclick = function () {
    if (!confirm("Delete the entry for " + viewingDate + "?")) return;
    entries = JP.deleteEntry(entries, viewingDate);
    refresh();
  };
  el("newPromptBtn").onclick = function () { shuffleSalt = 0; renderToday(); };
  el("prevDay").onclick = function () { viewingDate = JP.addDaysISO(viewingDate, -1); shuffleSalt = 0; renderToday(); };
  el("nextDay").onclick = function () { viewingDate = JP.addDaysISO(viewingDate, 1); shuffleSalt = 0; renderToday(); };
  el("todayBtn").onclick = function () { viewingDate = JP.todayISO(); shuffleSalt = 0; renderToday(); };
  el("searchBox").oninput = renderEntries;
  // Autosize + word count
  el("entryText").oninput = function () {
    el("wordCount").textContent = JP.wordCount(el("entryText").value) + " words";
  };
  setTab("today");
}

document.addEventListener("DOMContentLoaded", init);
})();
