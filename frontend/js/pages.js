import { createAskCard, createQueryPanels, createFileUpload } from "./components.js";
import { icon } from "./icons.js";
import { el, html, spinner, copyText } from "./utils.js";
import {
  convertToSql, executeQuery, evaluateSql,
  uploadPdf, askPdf,
  uploadExcel, askExcel, executeExcelQuery,
  normalizeResult, extractSql, extractAnswer, extractFileId, hasRows,
} from "./api.js";
import { speakText, stopSpeaking, isSpeaking, makeResultSpeech } from "./speak.js"; // NEW: for voice output

// ---------------------------------------------------------------------------
// SQL database
// ---------------------------------------------------------------------------
export function initDatabasePage(container) {
  const panels = createQueryPanels({
    hideRunButton: true, // NEW: no Run Query button, the answer comes directly
    onRun: async (sql) => {
      panels.setRunning(true);
      ask.setError("");
      try {
        // NEW: saved the result in a variable so we can also speak it
        const result = normalizeResult(await executeQuery(sql)) ?? { columns: [], rows: [] };
        panels.setResult(result);
        ask.setSpeech(makeResultSpeech(result)); // NEW
      } catch (e) {
        panels.setResult(null);
        ask.setError(e.message);
      } finally {
        panels.setRunning(false);
      }
    },
  });

  const ask = createAskCard({
    subtitle: "Describe what you want to know about your database in plain English, or use the mic.",
    placeholder: "e.g. Give the number of employees in the company",
    examples: ["Give the number of employees in the company", "Find the second highest salary with employee details"],
    buttonLabel: "Generate Answer", // NEW: was "Generate SQL"
    loadingLabel: "Generating…",
    onSubmit: async (question) => {
      const text = question.trim();
      if (!text) return ask.setError("Type or speak a question first.");
      ask.setValue(text);
      ask.setLoading(true);
      ask.setError("");
      panels.setResult(null);
      ask.setSpeech(""); // NEW: clear old answer
      try {
        const data = await convertToSql(text);
        const sql = extractSql(data); // NEW: keep the SQL in a variable
        panels.setSql(sql);

        // NEW: run the SQL straight away (no need to press Run Query)
        const result = normalizeResult(await executeQuery(sql)) ?? { columns: [], rows: [] };
        panels.setResult(result);
        ask.setSpeech(makeResultSpeech(result));
      } catch (e) {
        ask.setError(e.message);
      } finally {
        ask.setLoading(false);
      }
    },
  });

  container.append(ask.element, panels.element);
}

// ---------------------------------------------------------------------------
// Evaluation: ask a question, see the model's generated SQL + its result,
// then paste in the correct SQL to compare and see the model's accuracy.
// ---------------------------------------------------------------------------
function renderMiniTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return el("p", "eval-sub", "No rows returned.");
  }
  const columns = Object.keys(rows[0]);
  const wrap = el("div", "table-wrap eval-mini-table");
  const table = el("table");

  const thead = el("thead");
  const headRow = el("tr");
  columns.forEach((c) => headRow.append(el("th", "", c.replace(/_/g, " "))));
  thead.append(headRow);

  const tbody = el("tbody");
  rows.slice(0, 50).forEach((row) => {
    const tr = el("tr");
    columns.forEach((c) => {
      const value = row[c];
      const td = el("td", typeof value === "number" ? "num" : "");
      if (value === null || value === undefined) {
        td.append(el("span", "null", "null"));
      } else {
        td.textContent = typeof value === "object" ? JSON.stringify(value) : String(value);
      }
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(thead, tbody);
  wrap.append(table);
  if (rows.length > 50) wrap.append(el("p", "eval-sub", `Showing first 50 of ${rows.length} rows.`));
  return wrap;
}

// NEW: one result column (title + row count + table, or an error message)
function resultColumn(title, rows, error) {
  const count = Array.isArray(rows) ? rows.length : 0;
  const col = el("div", "eval-result-col");
  col.append(el("h3", "eval-result-heading", error ? title : `${title} (${count} ${count === 1 ? "row" : "rows"})`));
  col.append(error ? el("div", "error", error) : renderMiniTable(rows));
  return col;
}

function createEvalCard({ onCompare }) {
  const grid = html(`
    <div class="grid">
      <section class="card eval-card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Your SQL</h2>
            <p class="card-sub">Paste the correct / expected SQL query for this question.</p>
          </div>
        </div>
        <textarea class="code eval-sql" placeholder="Paste the correct / expected SQL query here." spellcheck="false"></textarea>
        <button class="btn btn-dark compare-btn" disabled></button>
        <div class="error" role="alert" hidden></div>
      </section>

      <section class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Results</h2>
            <p class="card-sub result-count">Compare to see results</p>
          </div>
        </div>
        <div class="eval-score" hidden></div>
        <div class="result-body"></div>
      </section>
    </div>
  `);

  const textarea = grid.querySelector(".eval-sql");
  const compareBtn = grid.querySelector(".compare-btn");
  const errorBox = grid.querySelector(".error");
  const countText = grid.querySelector(".result-count");
  const scoreBox = grid.querySelector(".eval-score");
  const body = grid.querySelector(".result-body");

  let enabled = false;
  let loading = false;

  function renderButton() {
    compareBtn.disabled = loading || !enabled || !textarea.value.trim();
    compareBtn.innerHTML = `${loading ? spinner : icon("check")} <span></span>`;
    compareBtn.querySelector("span").textContent = loading ? "Comparing…" : "Compare & Evaluate";
  }

  function setError(msg) {
    errorBox.textContent = msg || "";
    errorBox.hidden = !msg;
  }

  // NEW: shows BOTH the model's result and the user's result side by side
  function renderResult(data) {
    scoreBox.innerHTML = "";
    body.innerHTML = "";

    if (!data) {
      scoreBox.hidden = true;
      countText.textContent = "Compare to see results";
      body.append(el("div", "empty", "No results yet. Paste the correct SQL and press Compare & Evaluate."));
      return;
    }

    const g = data.generated_row_count ?? 0;
    const a = data.actual_row_count ?? 0;
    countText.textContent = `Model: ${g} ${g === 1 ? "row" : "rows"} · Yours: ${a} ${a === 1 ? "row" : "rows"}`;

    const pct = Math.round(data.row_accuracy ?? 0);
    const tone = data.exact_match ? "match" : pct >= 50 ? "partial" : "mismatch";
    const label = data.exact_match ? "100% (exact match)" : `${pct}%`;

    scoreBox.hidden = false;
    const scoreRow = el("div", "eval-score-row");
    scoreRow.append(el("span", "eval-score-label", "Accuracy vs. generated SQL"));
    scoreRow.append(el("span", `eval-badge ${tone}`, label));
    scoreBox.append(scoreRow);
    scoreBox.append(
      el("p", "eval-sub", "Based on the percentage of overlapping rows between the generated SQL's result and your correct SQL's result.")
    );

    // Both results, side by side
    const resultsGrid = el("div", "eval-results-grid");
    resultsGrid.append(
      resultColumn("Model's SQL result", data.generated_rows, data.generated_error && `Generated SQL failed to run: ${data.generated_error}`),
      resultColumn("Your SQL result", data.actual_rows, data.actual_error && `Could not run your SQL: ${data.actual_error}`)
    );
    body.append(resultsGrid);
  }

  textarea.addEventListener("input", renderButton);
  compareBtn.addEventListener("click", () => onCompare(textarea.value));

  renderButton();
  renderResult(null);

  return {
    element: grid,
    enable: () => {
      enabled = true;
      renderButton();
    },
    reset: () => {
      enabled = false;
      textarea.value = "";
      setError("");
      renderResult(null);
      renderButton();
    },
    setLoading: (v) => {
      loading = v;
      renderButton();
    },
    setError,
    setResult: renderResult,
  };
}

export function initEvaluationPage(container) {
  let lastQuestion = "";
  let lastGeneratedSql = "";

  const panels = createQueryPanels({
    queryTitle: "Generated SQL",
    hideRunButton: true,
    onRun: async (sql) => {
      panels.setRunning(true);
      ask.setError("");
      try {
        const result = normalizeResult(await executeQuery(sql)) ?? { columns: [], rows: [] };
        panels.setResult(result);
      } catch (e) {
        panels.setResult(null);
        ask.setError(e.message);
      } finally {
        panels.setRunning(false);
      }
    },
  });

  const evalCard = createEvalCard({
    onCompare: async (actualSql) => {
      if (!lastGeneratedSql) return evalCard.setError("Generate a SQL query above first.");
      const trimmed = actualSql.trim();
      if (!trimmed) return evalCard.setError("Enter the correct SQL query to compare against.");
      evalCard.setLoading(true);
      evalCard.setError("");
      try {
        const data = await evaluateSql(lastQuestion, lastGeneratedSql, trimmed);
        evalCard.setResult(data);
      } catch (e) {
        evalCard.setError(e.message);
      } finally {
        evalCard.setLoading(false);
      }
    },
  });

  const ask = createAskCard({
    subtitle: "Ask a question in plain English. The model will generate SQL for it — you can then check how accurate that SQL is.",
    placeholder: "e.g. Find the second highest salary with employee details",
    examples: ["Give the number of employees in the company", "Find the second highest salary with employee details"],
    buttonLabel: "Generate SQL",
    loadingLabel: "Generating…",
    onSubmit: async (question) => {
      const text = question.trim();
      if (!text) return ask.setError("Type or speak a question first.");
      ask.setValue(text);
      ask.setLoading(true);
      ask.setError("");
      panels.setResult(null);
      evalCard.reset();
      try {
        const data = await convertToSql(text);
        const sql = extractSql(data);
        lastQuestion = text;
        lastGeneratedSql = sql;
        panels.setSql(sql);

        const result = normalizeResult(await executeQuery(sql)) ?? { columns: [], rows: [] };
        panels.setResult(result);
        evalCard.enable();
      } catch (e) {
        lastGeneratedSql = "";
        ask.setError(e.message);
      } finally {
        ask.setLoading(false);
      }
    },
  });

  container.append(ask.element, panels.element, evalCard.element);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
export function initPdfPage(container) {
  let uploadState = { ready: false };
  const history = [];

  const answersCard = el("section", "card");
  const answersHead = el("div");
  const answersCount = el("p", "card-sub");
  answersHead.append(el("h2", "card-title", "Answers"), answersCount);
  const answersBody = el("div");
  answersCard.append(answersHead, answersBody);

  function renderAnswers() {
    answersCount.textContent = history.length
      ? `${history.length} ${history.length === 1 ? "answer" : "answers"}`
      : "Answers from your document appear here";
    answersBody.innerHTML = "";

    if (!history.length) {
      answersBody.append(el("div", "empty", "No answers yet. Upload a PDF and ask a question."));
      return;
    }

    const list = el("div", "answers");
    history.forEach((item) => {
      const article = el("article", "answer");
      const head = el("div", "answer-head");
      const copyBtn = el("button", "icon-btn plain");
      copyBtn.innerHTML = icon("copy");
      copyBtn.setAttribute("aria-label", "Copy answer");
      copyBtn.addEventListener("click", async () => {
        if (await copyText(item.answer)) {
          copyBtn.innerHTML = icon("check");
          setTimeout(() => (copyBtn.innerHTML = icon("copy")), 1500);
        }
      });
      // NEW: speaker button for each answer
      const listenBtn = el("button", "icon-btn plain", "🔊");
      listenBtn.setAttribute("aria-label", "Listen to answer");
      listenBtn.addEventListener("click", () => {
        if (isSpeaking()) {
          stopSpeaking();
        } else {
          speakText(item.answer);
        }
      });
      const buttons = el("div");          // NEW: box to keep both buttons together
      buttons.style.display = "flex";     // NEW
      buttons.append(listenBtn, copyBtn); // NEW

      head.append(el("p", "answer-q", item.question), buttons); // NEW: buttons instead of copyBtn
      article.append(head, el("p", "answer-a", item.answer));

      if (Array.isArray(item.sources) && item.sources.length) {
        const sources = item.sources.map((s) => (typeof s === "object" ? s.page ?? JSON.stringify(s) : s)).join(", ");
        article.append(el("p", "answer-src", `Sources: ${sources}`));
      }
      list.append(article);
    });
    answersBody.append(list);
  }

  const ask = createAskCard({
    subtitle: "Upload a PDF first to start asking questions.",
    placeholder: "e.g. Summarize the key points of this document",
    buttonLabel: "Generate Answer", // NEW: was "Ask PDF"
    loadingLabel: "Reading…",
    onSubmit: async (question) => {
      const text = question.trim();
      if (!uploadState.ready) return ask.setError("Upload a PDF before asking a question.");
      if (!text) return ask.setError("Type or speak a question first.");
      ask.setLoading(true);
      ask.setError("");
      ask.setSpeech(""); // NEW: clear old answer
      try {
        const data = await askPdf(text, uploadState.fileId);
        history.unshift({ question: text, answer: extractAnswer(data) || "No answer returned.", sources: data?.sources });
        ask.setSpeech(history[0].answer); // NEW: newest answer is at position 0
        ask.setValue("");
        renderAnswers();
      } catch (e) {
        ask.setError(e.message);
      } finally {
        ask.setLoading(false);
      }
    },
  });

  const upload = createFileUpload({
    title: "Upload a PDF",
    subtitle: "Add a document, then ask questions about what's inside it.",
    accept: "application/pdf,.pdf",
    extensions: [".pdf"],
    iconName: "pdf",
    uploadFn: uploadPdf,
    getFileId: extractFileId,
    onChange: (state) => {
      const wasReady = uploadState.ready;
      uploadState = state;
      ask.setDisabled(!state.ready);
      ask.setSubtitle(state.ready ? `Ask anything about ${state.file.name}.` : "Upload a PDF first to start asking questions.");
      ask.setExamples(state.ready ? ["Summarize this document", "List the important dates mentioned"] : []);
      if (!state.file || (wasReady && !state.ready)) {
        history.length = 0;
        renderAnswers();
      }
    },
  });

  ask.setDisabled(true);
  renderAnswers();
  container.append(upload.element, ask.element, answersCard);
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------
export function initExcelPage(container) {
  let uploadState = { ready: false };

  const panels = createQueryPanels({
    queryTitle: "Generated Query",
    hideRunButton: true, // NEW: no Run Query button, the answer comes directly
    onRun: async (sql) => {
      panels.setRunning(true);
      ask.setError("");
      try {
        // NEW: saved the result in a variable so we can also speak it
        const result = normalizeResult(await executeExcelQuery(sql, uploadState.fileId)) ?? { columns: [], rows: [] };
        panels.setResult(result);
        ask.setSpeech(makeResultSpeech(result)); // NEW
      } catch (e) {
        panels.setResult(null);
        ask.setError(e.message);
      } finally {
        panels.setRunning(false);
      }
    },
  });

  const ask = createAskCard({
    subtitle: "Upload an Excel file first to start asking questions.",
    placeholder: "e.g. What is the total sales for each region?",
    buttonLabel: "Generate Answer", // NEW: was "Generate Query"
    loadingLabel: "Generating…",
    onSubmit: async (question) => {
      const text = question.trim();
      if (!uploadState.ready) return ask.setError("Upload an Excel file before asking a question.");
      if (!text) return ask.setError("Type or speak a question first.");
      ask.setValue(text);
      ask.setLoading(true);
      ask.setError("");
      panels.setResult(null);
      panels.setAnswer("");
      ask.setSpeech(""); // NEW: clear old answer
      try {
        const data = await askExcel(text, uploadState.fileId);
        const sql = extractSql(data); // NEW: keep the query in a variable
        panels.setSql(sql);

        // NEW: get the result table
        let result = null;
        if (hasRows(data)) {
          // the backend already sent the rows
          result = normalizeResult(data);
        } else if (sql) {
          // the backend sent only the query, so we run it straight away
          result = normalizeResult(await executeExcelQuery(sql, uploadState.fileId)) ?? { columns: [], rows: [] };
        }
        if (result) panels.setResult(result);

        if (data && typeof data === "object" && data.answer) panels.setAnswer(extractAnswer(data));

        // NEW: speak the answer, or the rows
        if (data && data.answer) {
          ask.setSpeech(extractAnswer(data));
        } else if (result) {
          ask.setSpeech(makeResultSpeech(result));
        }
      } catch (e) {
        ask.setError(e.message);
      } finally {
        ask.setLoading(false);
      }
    },
  });

  const upload = createFileUpload({
    title: "Upload an Excel file",
    subtitle: "Add a spreadsheet, then query its data in plain English.",
    accept: ".xlsx,.xls,.csv",
    extensions: [".xlsx", ".xls", ".csv"],
    iconName: "excel",
    uploadFn: uploadExcel,
    getFileId: extractFileId,
    onChange: (state) => {
      uploadState = state;
      ask.setDisabled(!state.ready);
      ask.setSubtitle(state.ready ? `Ask about the data in ${state.file.name}.` : "Upload an Excel file first to start asking questions.");
      ask.setExamples(state.ready ? ["Show the first 10 rows", "Find the row with the highest value"] : []);
      if (!state.file) panels.clear();
    },
  });

  ask.setDisabled(true);
  container.append(upload.element, ask.element, panels.element);
}