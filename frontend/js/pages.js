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
function createEvalCard({ onCompare }) {
  const card = html(`
    <section class="card eval-card">
      <div>
        <h2 class="card-title">Evaluate the generated SQL</h2>
        <p class="card-sub">Generate a query above, then paste the correct SQL query below to see how accurate the model's SQL was.</p>
      </div>
      <textarea class="code eval-sql" placeholder="Paste the correct / expected SQL query here." spellcheck="false" rows="6"></textarea>
      <button class="btn btn-dark compare-btn" disabled></button>
      <div class="error" role="alert" hidden></div>
      <div class="eval-result" hidden></div>
    </section>
  `);

  const textarea = card.querySelector(".eval-sql");
  const compareBtn = card.querySelector(".compare-btn");
  const errorBox = card.querySelector(".error");
  const resultBox = card.querySelector(".eval-result");

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

  function renderResult(data) {
    resultBox.innerHTML = "";
    if (!data) {
      resultBox.hidden = true;
      return;
    }
    resultBox.hidden = false;

    const pct = Math.round(data.row_accuracy ?? 0);
    const tone = data.exact_match ? "match" : pct >= 50 ? "partial" : "mismatch";
    const label = data.exact_match ? "100% (exact match)" : `${pct}%`;

    const scoreRow = el("div", "eval-score");
    scoreRow.append(el("span", "eval-score-label", "Accuracy"));
    scoreRow.append(el("span", `eval-badge ${tone}`, label));
    resultBox.append(scoreRow);

    resultBox.append(
      el("p", "eval-sub", "Based on the percentage of overlapping rows between the generated SQL's result and your correct SQL's result.")
    );

    resultBox.append(
      el(
        "p",
        "eval-sub",
        `Generated SQL returned ${data.generated_row_count ?? 0} row(s); your SQL returned ${data.actual_row_count ?? 0} row(s).`
      )
    );

    if (data.generated_error) resultBox.append(el("p", "eval-sub eval-err", `Generated SQL error: ${data.generated_error}`));
    if (data.actual_error) resultBox.append(el("p", "eval-sub eval-err", `Your SQL error: ${data.actual_error}`));
  }

  textarea.addEventListener("input", renderButton);
  compareBtn.addEventListener("click", () => onCompare(textarea.value));

  renderButton();

  return {
    element: card,
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