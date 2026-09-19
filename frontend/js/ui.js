// NEW FILE (UI update): chat-style layout for LinguaSQL.
//
// IMPORTANT: this file does NOT change any logic written by the team.
// app.js / pages.js / components.js build the pages exactly like before.
// This file only runs AFTER them and:
//   - moves the existing elements into a chat-style layout (moving an element
//     keeps all of its click / voice / upload listeners working),
//   - adds visual extras (question bubble, View SQL / View Results tabs,
//     syntax-highlighted SQL, info line, Download PDF / Excel buttons).

import { downloadPdf, downloadExcel } from "./export.js";

// Shown in the info line under the results. Change it if your database name changes.
const DATABASE_LABEL = "cxyz_comp";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const SVG = {
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  bot: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>',
  code: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>',
  grid: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',
  db: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/></svg>',
  clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  rows: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18"/></svg>',
  speaker: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
};

// Multi-colour palette for the bar and pie charts
const COLORS = ["#2d6a4f", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16", "#f97316", "#06b6d4", "#6366f1", "#eab308"];

function make(tag, cls, htmlStr) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (htmlStr !== undefined) n.innerHTML = htmlStr;
  return n;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Watch a textarea's .value (it is set by code, which fires no event).
// This only adds a notification; the value still works exactly the same.
function watchValue(textarea, cb) {
  const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  Object.defineProperty(textarea, "value", {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); cb(desc.get.call(this)); },
  });
  textarea.addEventListener("input", () => cb(textarea.value));
}

// Very small SQL highlighter for the "View SQL" tab
const KW = /^(SELECT|DISTINCT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DESC|ASC|UNION|ALL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|WITH|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX|LIKE|BETWEEN|EXISTS|OVER|PARTITION|ROUND|COALESCE|CAST)$/i;
function highlightSql(sql) {
  return sql.split(/\r?\n/).map((line) => {
    let h = escapeHtml(line);
    // strings first, then numbers, then keywords (skip inside already-created spans)
    h = h.replace(/('[^']*')/g, '<span class="tk-str">$1</span>');
    h = h.replace(/(<span[^>]*>.*?<\/span>)|\b(\d+(?:\.\d+)?)\b/g, (m, span, num) => span || `<span class="tk-num">${num}</span>`);
    h = h.replace(/(<span[^>]*>.*?<\/span>)|\b([A-Za-z_]+)\b/g, (m, span, word) =>
      span || (KW.test(word) ? `<span class="tk-kw">${word}</span>` : word)
    );
    return `<span class="ln"></span><span class="lc">${h || " "}</span>`;
  }).map((l) => `<div class="code-line">${l}</div>`).join("");
}

// Reads the rendered result table into { columns, rows }
function readTable(root) {
  const table = root.querySelector("table");
  if (!table) return null;
  const columns = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
  const rows = [...table.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((td) => {
      if (td.querySelector(".null")) return null;
      const t = td.textContent;
      return td.classList.contains("num") && t !== "" && !isNaN(Number(t)) ? Number(t) : t;
    })
  );
  return { columns, rows };
}

function scrollDown(thread) {
  requestAnimationFrame(() => thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" }));
}

function downloadButtons(getData) {
  const box = make("div", "ls-dl");
  const pdf = make("button", "ls-chip-btn", `${SVG.down}<span>PDF</span>`);
  const xls = make("button", "ls-chip-btn", `${SVG.down}<span>Excel</span>`);
  pdf.type = xls.type = "button";
  pdf.title = "Download answer as PDF";
  xls.title = "Download answer as Excel";
  const run = async (btn, fn) => {
    const label = btn.querySelector("span");
    const old = label.textContent;
    btn.disabled = true;
    label.textContent = "…";
    try { await fn(getData()); } finally { btn.disabled = false; label.textContent = old; }
  };
  pdf.addEventListener("click", () => run(pdf, downloadPdf));
  xls.addEventListener("click", () => run(xls, downloadExcel));
  box.append(pdf, xls);
  return box;
}

// ---------------------------------------------------------------------------
// Composer: turns the existing "Ask a question" card into the bottom input bar
// ---------------------------------------------------------------------------
function buildComposer(page, ask, { syncPlaceholder }) {
  const textarea = ask.querySelector("textarea");
  const wrap = ask.querySelector(".input-wrap");
  const submit = ask.querySelector(".submit-btn");
  const micBtn = ask.querySelector(".mic-btn:not(.wave-btn)");
  const waveBtn = ask.querySelector(".wave-btn");
  const tryBox = ask.querySelector(".try");
  const sub = ask.querySelector(".card-sub");

  const composer = make("div", "ls-composer");
  const chips = make("div", "ls-chips");
  if (tryBox) chips.append(tryBox); // example questions become pill chips

  // input row: textarea | voice-to-voice | mic | send  (same buttons, new order)
  textarea.rows = 1;
  wrap.classList.add("ls-input");
  if (waveBtn) wrap.append(waveBtn);
  if (micBtn) wrap.append(micBtn);
  if (submit) {
    submit.setAttribute("aria-label", "Send");
    submit.title = "Send";
    wrap.append(submit);
  }

  // Enter = send, Shift+Enter = new line (Ctrl+Enter from the team still works)
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.isComposing) {
      e.preventDefault();
      if (submit && !submit.disabled) submit.click();
    }
  });

  // auto-grow the input
  const grow = () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  };
  watchValue(textarea, grow);

  // PDF / Excel: the subtitle ("Ask anything about file.pdf") becomes the placeholder
  if (syncPlaceholder && sub) {
    const apply = () => { textarea.placeholder = sub.textContent.replace(/\.$/, "") + "…"; };
    apply();
    new MutationObserver(apply).observe(sub, { childList: true, characterData: true, subtree: true });
  }

  composer.append(chips, ask);
  page.append(composer);
  return { textarea, submit, chips };
}

// Fires cb(true/false) when the send button starts/stops its loading spinner
function onLoading(submit, cb) {
  let was = false;
  const check = () => {
    const now = !!submit.querySelector(".spinner");
    if (now !== was) { was = now; cb(now); }
  };
  new MutationObserver(check).observe(submit, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// Result card: View SQL / View Results tabs around the existing panels
// ---------------------------------------------------------------------------
function buildResultCard(grid, { sourceLabel, getQuestion, getTiming }) {
  const [sqlSec, resSec] = grid.querySelectorAll(":scope > section");
  const code = sqlSec.querySelector(".code");
  const body = resSec.querySelector(".result-body");
  const answerBox = resSec.querySelector(".answer-inline");
  const resTitle = resSec.querySelector(".card-title");
  const countText = resSec.querySelector(".result-count");
  const viewBtns = resSec.querySelectorAll("[data-view]");

  const card = make("div", "ls-result");
  const tabs = make("div", "ls-tabs");
  const tSql = make("button", "ls-tab", `${SVG.code}<span>View SQL</span>`);
  const tRes = make("button", "ls-tab active", `${SVG.grid}<span>View Results</span>`);
  tSql.type = tRes.type = "button";
  tabs.append(tSql, tRes);

  // --- SQL tab: highlighted code + Copy SQL
  sqlSec.classList.add("ls-pane");
  const sqlHead = sqlSec.querySelector(".card-head");
  sqlHead.querySelector(".card-sub").hidden = true;
  const sqlActions = make("div", "ls-dl");
  const copyBtn = make("button", "ls-chip-btn", `${SVG.copy}<span>Copy SQL</span>`);
  copyBtn.type = "button";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      copyBtn.querySelector("span").textContent = "Copied";
      setTimeout(() => (copyBtn.querySelector("span").textContent = "Copy SQL"), 1400);
    } catch { /* ignore */ }
  });
  sqlActions.append(copyBtn);
  sqlHead.append(sqlActions);
  const pre = make("div", "ls-code");
  code.after(pre);
  watchValue(code, (v) => {
    pre.innerHTML = v ? highlightSql(v) : '<div class="ls-code-empty">Your query will appear here.</div>';
  });
  pre.innerHTML = '<div class="ls-code-empty">Your query will appear here.</div>';

  // --- Results tab
  resSec.classList.add("ls-pane");
  const resHead = resSec.querySelector(".card-head");
  const titleWrap = resHead.firstElementChild;
  titleWrap.classList.add("ls-title-row");
  const tools = make("div", "ls-tools");
  const toggle = resHead.querySelector(".view-toggle");
  const getData = () => {
    let table = readTable(body);
    if (!table) {
      // chart view is showing: switch to table for a moment to read the rows
      const active = resSec.querySelector("[data-view].active");
      const tableBtn = resSec.querySelector('[data-view="table"]');
      if (tableBtn && active !== tableBtn) {
        tableBtn.click();
        table = readTable(body);
        active.click();
      }
    }
    return {
      question: getQuestion(),
      answer: answerBox && !answerBox.hidden ? answerBox.textContent.trim() : "",
      sql: code.value,
      source: sourceLabel(),
      table,
    };
  };
  tools.append(downloadButtons(getData), toggle);
  resHead.append(tools);

  // title "Query Results · Bar chart"
  const baseTitle = resTitle.textContent;
  const viewNames = { table: "", chart: " · Bar chart", pie: " · Pie chart", line: " · Line chart" }; // NEW: line
  const setTitle = () => {
    const active = resSec.querySelector("[data-view].active");
    resTitle.textContent = baseTitle + (viewNames[active?.dataset.view] || "");
  };
  viewBtns.forEach((b) => b.addEventListener("click", setTitle));

  // info line: database · time · rows
  const meta = make("div", "ls-meta-line");
  const updateMeta = () => {
    const rows = (countText.textContent.match(/\d+/) || [""])[0];
    const t = getTiming();
    meta.innerHTML =
      `<span>${SVG.db} ${escapeHtml(sourceLabel())}</span>` +
      (t ? `<span>${SVG.clock} Execution Time: ${t} sec</span>` : "") +
      (rows !== "" ? `<span>${SVG.rows} Rows Returned: ${rows}</span>` : "");
  };
  resSec.append(meta);
  const sqlMeta = meta.cloneNode(true);
  sqlSec.append(sqlMeta);

  // charts: vertical bars + green pie colours (only restyles what chart.js drew)
  const polishCharts = () => {
    const chart = body.querySelector(".chart:not(.ls-vertical)");
    if (chart) {
      chart.classList.add("ls-vertical");
      const cap = chart.querySelector(".chart-caption");
      if (cap) resTitle.dataset.caption = cap.textContent;
      chart.querySelectorAll(".bar-row").forEach((row, i) => {
        const fill = row.querySelector(".bar-fill");
        const pct = parseFloat(fill.style.width) || 1;
        fill.style.width = "100%";
        fill.style.height = pct + "%";
        fill.style.background = COLORS[i % COLORS.length];
        // value on top of the bar
        const val = row.querySelector(".bar-value");
        fill.append(val);
      });
    }
    const pie = body.querySelector(".pie-chart:not(.ls-pie)");
    if (pie) {
      pie.classList.add("ls-pie");
      pie.querySelectorAll("svg path").forEach((p, i) => {
        p.setAttribute("fill", COLORS[i % COLORS.length]);
        p.setAttribute("stroke", "#fff");
        p.setAttribute("stroke-width", "2");
      });
      pie.querySelectorAll(".pie-swatch").forEach((s, i) => (s.style.background = COLORS[i % COLORS.length]));
    }
    // caption next to the title
    const capEl = body.querySelector(".chart-caption");
    const cap = resHead.querySelector(".ls-caption") || make("span", "ls-caption");
    cap.textContent = capEl ? capEl.textContent : "";
    titleWrap.querySelector(".card-title").after(cap);
    updateMeta();
    setTitle();
  };
  new MutationObserver(polishCharts).observe(body, { childList: true });
  new MutationObserver(updateMeta).observe(countText, { childList: true, characterData: true, subtree: true });

  // tabs
  const show = (which) => {
    const sqlOn = which === "sql";
    sqlSec.hidden = !sqlOn;
    resSec.hidden = sqlOn;
    tSql.classList.toggle("active", sqlOn);
    tRes.classList.toggle("active", !sqlOn);
    sqlMeta.innerHTML = meta.innerHTML;
  };
  tSql.addEventListener("click", () => show("sql"));
  tRes.addEventListener("click", () => show("res"));
  show("res");

  grid.classList.add("ls-panels");
  card.append(tabs, grid);

  // The team's answer text goes BELOW the card, like the design
  const answerOut = make("div", "ls-answer-slot");
  if (answerBox) answerOut.append(answerBox);

  return { card, answerOut, show, updateMeta, polishCharts };
}

// ---------------------------------------------------------------------------
// Chat turn (question bubble + bot bubble)
// ---------------------------------------------------------------------------
function buildTurn() {
  const turn = make("div", "ls-turn");
  const userRow = make("div", "ls-row ls-row-user");
  const bubble = make("div", "ls-bubble ls-bubble-user");
  userRow.append(bubble, make("div", "ls-avatar", SVG.user));
  const time = make("div", "ls-time");
  const botRow = make("div", "ls-row ls-row-bot");
  const botBody = make("div", "ls-bot-body");
  const botText = make("div", "ls-bubble ls-bubble-bot");
  botBody.append(botText);
  botRow.append(make("div", "ls-avatar", SVG.bot), botBody);
  turn.append(userRow, time, botRow);
  return {
    turn, botBody,
    setQuestion(q) { bubble.textContent = q; time.textContent = `${nowTime()} ✓✓`; },
    setBot(htmlStr) { botText.innerHTML = htmlStr; },
  };
}

const TYPING = '<span class="ls-typing"><i></i><i></i><i></i></span>';

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
function setupQueryPage(page, { upload = null, syncPlaceholder = false, extras = [] } = {}) {
  const ask = page.querySelector(":scope > .card.ask");
  const grid = page.querySelector(":scope > .grid");
  if (!ask || !grid) return;
  page.classList.add("ls-page");

  const top = make("div", "ls-top");
  const thread = make("div", "ls-thread");
  if (upload) top.append(upload);
  page.prepend(top);
  page.append(thread);

  const hero = make("div", "ls-hero",
    `<div class="ls-hero-icon">${SVG.bot}</div><h3>What would you like to know?</h3><p>Ask a question in plain English or use the mic. Pick an example below to get started.</p>`);

  let question = "";
  let started = 0;
  let timing = "";
  const fileName = () => page.querySelector(".file-meta strong")?.textContent || "";
  const sourceLabel = () => (upload ? `File: ${fileName()}` : `Database: ${DATABASE_LABEL}`);

  const t = buildTurn();
  const result = buildResultCard(grid, { sourceLabel, getQuestion: () => question, getTiming: () => timing });
  t.botBody.append(result.card, result.answerOut, ...extras);
  t.turn.hidden = true;
  thread.append(hero, t.turn);

  const { textarea, submit } = buildComposer(page, ask, { syncPlaceholder });

  const errorBox = ask.querySelector(".error");
  const resultBody = grid.querySelector(".result-body");
  const countText = grid.querySelector(".result-count");

  onLoading(submit, (loading) => {
    if (loading) {
      question = textarea.value.trim();
      started = performance.now();
      timing = "";
      hero.hidden = true;
      t.turn.hidden = false;
      t.setQuestion(question);
      t.setBot(TYPING);
      result.card.hidden = true;
      scrollDown(thread);
    } else {
      timing = ((performance.now() - started) / 1000).toFixed(2);
      const failed = errorBox && !errorBox.hidden;
      const hasSql = !!grid.querySelector(".code").value;
      const n = (countText.textContent.match(/\d+/) || [])[0];
      if (failed) {
        // show the backend's message (e.g. "Sorry, I couldn't understand that...") in the chat
        const msg = errorBox.textContent.trim();
        t.setBot(escapeHtml(msg || "Sorry, I couldn't answer that. Please try again."));
        errorBox.hidden = true;
        result.card.hidden = !hasSql;
        if (hasSql) result.show("sql");
      } else {
        t.setBot(
          n === undefined
            ? "Here's what I found."
            : n === "0"
              ? "The query ran, but no rows matched your question."
              : `Here's what I found for your question — ${n} ${n === "1" ? "row" : "rows"}.`
        );
        result.card.hidden = false;
        result.show("res");
        textarea.value = "";
      }
      result.updateMeta();
      scrollDown(thread);
    }
  });

  // keep the view scrolled when the answer text arrives later
  const ans = result.answerOut.querySelector(".answer-inline");
  if (ans) new MutationObserver(() => scrollDown(thread)).observe(ans, { attributes: true, childList: true });
  new MutationObserver(() => result.polishCharts()).observe(resultBody, { childList: true });

  // Excel page: clearing the file clears the chat
  if (upload) {
    const syncUpload = () => {
      const hasFile = !!upload.querySelector(".file-row");
      page.classList.toggle("ls-nofile", !hasFile);
      if (!hasFile) { t.turn.hidden = true; hero.hidden = false; }
    };
    new MutationObserver(syncUpload).observe(upload, { childList: true, subtree: true });
    syncUpload();
  }
}

function setupPdfPage(page) {
  const ask = page.querySelector(":scope > .card.ask");
  const upload = [...page.querySelectorAll(":scope > section.card")].find((s) => s.querySelector(".upload-body"));
  const answersCard = [...page.querySelectorAll(":scope > section.card")].find((s) => s !== upload && s !== ask);
  if (!ask || !upload || !answersCard) return;
  page.classList.add("ls-page", "ls-pdf");

  const top = make("div", "ls-top");
  top.append(upload);
  const thread = make("div", "ls-thread");
  answersCard.classList.add("ls-answers");
  const pending = buildTurn();
  pending.turn.hidden = true;
  thread.append(answersCard, pending.turn);
  page.prepend(top);
  page.append(thread);

  const { textarea, submit } = buildComposer(page, ask, { syncPlaceholder: true });
  const errorBox = ask.querySelector(".error");
  const times = new Map();

  onLoading(submit, (loading) => {
    if (loading) {
      const q = textarea.value.trim();
      times.set(q, `${nowTime()} ✓✓`);
      pending.setQuestion(q);
      pending.setBot(TYPING);
      pending.turn.hidden = false;
    } else {
      pending.turn.hidden = true;
      if (errorBox && !errorBox.hidden) pending.turn.hidden = true;
    }
    scrollDown(thread);
  });

  // Re-shape each answer (the team's article) into chat bubbles.
  const shape = () => {
    answersCard.querySelectorAll("article.answer:not(.ls-done)").forEach((art) => {
      art.classList.add("ls-done");
      const q = art.querySelector(".answer-q");
      const a = art.querySelector(".answer-a");
      const src = art.querySelector(".answer-src");
      const btns = art.querySelector(".answer-head > div");
      const question = q?.textContent || "";

      const turn = buildTurn();
      turn.setQuestion(question);
      if (times.has(question)) turn.turn.querySelector(".ls-time").textContent = times.get(question);
      turn.turn.querySelector(".ls-bubble-bot").remove();
      const card = make("div", "ls-answer-card");
      if (a) card.append(a);
      if (src) card.append(src);
      const actions = make("div", "ls-actions");
      if (btns) {
        btns.removeAttribute("style");
        btns.classList.add("ls-icon-row");
        btns.querySelectorAll("button").forEach((b) => {
          b.classList.add("ls-sq");
          if (b.textContent.trim() === "🔊") b.innerHTML = SVG.speaker;
        });
        actions.append(btns);
      }
      actions.append(downloadButtons(() => ({
        question,
        answer: a?.textContent || "",
        source: `File: ${page.querySelector(".file-meta strong")?.textContent || ""}`,
      })));
      card.append(actions);
      turn.botBody.append(card);
      art.innerHTML = "";
      art.append(turn.turn);
    });
    scrollDown(thread);
  };
  new MutationObserver(shape).observe(answersCard, { childList: true, subtree: true });
  shape();

  const syncUpload = () => page.classList.toggle("ls-nofile", !upload.querySelector(".file-row"));
  new MutationObserver(syncUpload).observe(upload, { childList: true, subtree: true });
  syncUpload();
}

function setupEvaluationPage(page) {
  const grids = page.querySelectorAll(":scope > .grid");
  const evalGrid = [...grids].find((g) => g.querySelector(".eval-sql"));
  if (evalGrid) evalGrid.classList.add("ls-eval");
  setupQueryPage(page, { extras: evalGrid ? [evalGrid] : [] });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
document.body.classList.add("ls");
setupQueryPage(document.getElementById("page-sql"));
setupPdfPage(document.getElementById("page-pdf"));
setupQueryPage(document.getElementById("page-excel"), {
  upload: [...document.querySelectorAll("#page-excel > section.card")].find((s) => s.querySelector(".upload-body")),
  syncPlaceholder: true,
});
setupEvaluationPage(document.getElementById("page-evaluation"));