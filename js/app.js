/* JournalPilot AI — DOM glue. Depends on window.JournalPilot and window.JournalPrompts. */
(function () {
"use strict";

const JP = window.JournalPilot;
const PR = window.JournalPrompts;

let entries = JP.loadEntries();
let viewingDate = JP.todayISO();
let currentTab = "today";
let activeTag = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;
const GOAL_KEY = "journalpilot:goal";
let wordGoal = parseInt((function () { try { return localStorage.getItem(GOAL_KEY); } catch (e) { return ""; } })() || "", 10) || JP.DEFAULT_WORD_GOAL;

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
  else if (currentTab === "entries") { renderTagChips(); renderEntries(); }
  else renderInsights();
}

function updateGoalBar() {
  const gp = JP.goalProgress(JP.wordCount(el("entryText").value), wordGoal);
  el("goalFill").style.width = gp.pct + "%";
  el("goalFill").classList.toggle("met", gp.met);
  el("goalText").textContent = gp.met
    ? "Goal met — " + gp.words + " / " + gp.goal + " words"
    : gp.words + " / " + gp.goal + " words";
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
  el("wordGoal").value = wordGoal;
  updateGoalBar();

  document.querySelectorAll("#moodRow .mood").forEach(function (b) {
    const m = b.dataset.mood;
    b.classList.toggle("sel", existing ? existing.mood === m : m === "okay");
  });

  el("saveNote").textContent = existing
    ? "Last saved " + new Date(existing.updatedAt).toLocaleString() + "."
    : "Not written yet.";
  el("deleteBtn").style.display = existing ? "" : "none";
  el("shuffleBtn").onclick = function () { shufflePrompt(date); };
  renderOnThisDay(date);
}

function renderOnThisDay(date) {
  const box = el("onThisDay");
  const past = JP.onThisDay(entries, date);
  if (!past.length) {
    box.innerHTML = '<p class="muted small">Nothing from this date in past years — yet.</p>';
    return;
  }
  box.innerHTML = past.map(function (e) {
    const yrs = parseInt(date.slice(0, 4), 10) - parseInt(e.date.slice(0, 4), 10);
    return '<div class="card otd-card" data-date="' + e.date + '">' +
      '<div class="entry-head"><strong>' + e.date + "</strong>" +
      '<span class="pill">' + yrs + (yrs === 1 ? " year" : " years") + " ago</span>" +
      '<span class="moodtag"><span class="mdot" style="background:' + JP.MOOD_COLORS[e.mood] + '"></span> ' + JP.MOOD_LABELS[e.mood] + "</span></div>" +
      '<div class="entry-text">' + esc(e.text.length > 200 ? e.text.slice(0, 200) + "…" : e.text) + "</div>" +
      '<button class="linkbtn open-entry" data-date="' + e.date + '">Open / edit</button></div>';
  }).join("");
  box.querySelectorAll(".open-entry").forEach(function (b) {
    b.onclick = function () { viewingDate = b.dataset.date; shuffleSalt = 0; renderToday(); };
  });
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
    el("saveNote").textContent = "Couldn't save: " + err.message;
  }
}

function renderTagChips() {
  const tags = JP.entryTags(entries);
  const box = el("tagChips");
  if (!tags.length) { box.innerHTML = ""; return; }
  box.innerHTML = '<span class="taglbl">Tags:</span>' + tags.map(function (t) {
    return '<button class="tagchip' + (activeTag === t.tag ? " sel" : "") + '" data-tag="' + esc(t.tag) + '">' +
      "#" + esc(t.tag) + " <span class='tcount'>" + t.count + "</span></button>";
  }).join("") + (activeTag ? ' <button class="linkbtn" id="clearTag">clear</button>' : "");
  box.querySelectorAll(".tagchip").forEach(function (b) {
    b.onclick = function () {
      activeTag = activeTag === b.dataset.tag ? null : b.dataset.tag;
      renderTagChips(); renderEntries();
    };
  });
  const clear = el("clearTag");
  if (clear) clear.onclick = function () { activeTag = null; renderTagChips(); renderEntries(); };
}

function renderEntries() {
  const q = el("searchBox").value || "";
  let list = q ? JP.searchEntries(entries, q) : entries.slice();
  if (activeTag) list = list.filter(function (e) { return JP.entriesWithTag([e], activeTag).length > 0; });
  const box = el("entryList");
  if (!list.length) {
    box.innerHTML = '<p class="muted">' + (activeTag ? "No entries tagged #" + esc(activeTag) + "."
      : q ? "No entries match your search." : "No entries yet. Write your first one in the Today tab.") + "</p>";
    return;
  }
  box.innerHTML = list.map(function (e) {
    return '<div class="card entry-card" data-date="' + e.date + '">' +
      '<div class="entry-head"><strong>' + e.date + "</strong>" +
      '<span class="moodtag"><span class="mdot" style="background:' + JP.MOOD_COLORS[e.mood] + '"></span> ' + JP.MOOD_LABELS[e.mood] + "</span>" +
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
    return '<div class="mrow"><span class="mlabel"><span class="mdot" style="background:' + JP.MOOD_COLORS[m] + '"></span> ' + JP.MOOD_LABELS[m] +
      '</span><div class="mbar"><div class="mfill" style="width:' + w + '%;background:' + JP.MOOD_COLORS[m] + '"></div></div>' +
      '<span class="mcount">' + counts[m] + "</span></div>";
  }).join("");
  el("insightStats").innerHTML =
    "<div class='stat'><strong>" + entries.length + "</strong><span>entries</span></div>" +
    "<div class='stat'><strong>" + JP.totalWords(entries).toLocaleString() + "</strong><span>words</span></div>" +
    "<div class='stat'><strong>" + JP.longestStreak(entries) + "</strong><span>longest streak</span></div>" +
    "<div class='stat'><strong>" + JP.currentStreak(entries) + "</strong><span>current streak</span></div>";
  renderCalendar();
}

const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function renderCalendar() {
  const days = JP.monthDays(entries, calYear, calMonth);
  el("calTitle").textContent = MONTH_LABELS[calMonth - 1] + " " + calYear;
  const head = ["M", "T", "W", "T", "F", "S", "S"].map(function (d) {
    return '<span class="cal-h">' + d + "</span>";
  }).join("");
  const cells = days.map(function (d) {
    const num = parseInt(d.date.slice(8, 10), 10);
    const dot = d.hasEntry
      ? '<span class="cal-dot" style="background:' + (JP.MOOD_COLORS[d.mood] || "#999") + '"></span>'
      : "";
    const cls = "cal-d" + (d.inMonth ? "" : " out") + (d.date === JP.todayISO() ? " today" : "") +
      (d.hasEntry ? " has" : "");
    return '<button class="' + cls + '" data-date="' + d.date + '" title="' + d.date + '">' +
      '<span class="cal-n">' + num + "</span>" + dot + "</button>";
  }).join("");
  el("calGrid").innerHTML = head + cells;
  el("calGrid").querySelectorAll(".cal-d.has").forEach(function (b) {
    b.onclick = function () { viewingDate = b.dataset.date; shuffleSalt = 0; setTab("today"); };
  });
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
    updateGoalBar();
  };
  el("wordGoal").onchange = function () {
    const v = parseInt(el("wordGoal").value, 10);
    wordGoal = v > 0 ? v : JP.DEFAULT_WORD_GOAL;
    el("wordGoal").value = wordGoal;
    try { localStorage.setItem(GOAL_KEY, String(wordGoal)); } catch (e) {}
    updateGoalBar();
  };
  el("exportMd").onclick = function () {
    if (!entries.length) { alert("No entries to export yet."); return; }
    const blob = new Blob([JP.entriesToMarkdown(entries)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "journal-export-" + JP.todayISO() + ".md";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  };
  el("calPrev").onclick = function () {
    calMonth--; if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendar();
  };
  el("calNext").onclick = function () {
    calMonth++; if (calMonth > 12) { calMonth = 1; calYear++; }
    renderCalendar();
  };
  setTab("today");
}

document.addEventListener("DOMContentLoaded", init);
})();
