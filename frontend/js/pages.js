import { createAskCard, createQueryPanels, createFileUpload } from "./components.js";
import { icon } from "./icons.js";
import { el, copyText } from "./utils.js";
import {
  convertToSql, executeQuery,
  uploadPdf, askPdf,
  uploadExcel, askExcel, executeExcelQuery,
  normalizeResult, extractSql, extractAnswer, extractFileId, hasRows,
} from "./api.js";

// ---------------------------------------------------------------------------
// SQL database
// ---------------------------------------------------------------------------
export function initDatabasePage(container) {
  const panels = createQueryPanels({
    onRun: async (sql) => {
      panels.setRunning(true);
      ask.setError("");
      try {
        panels.setResult(normalizeResult(await executeQuery(sql)) ?? { columns: [], rows: [] });
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
    buttonLabel: "Generate SQL",
    loadingLabel: "Generating…",
    onSubmit: async (question) => {
      const text = question.trim();
      if (!text) return ask.setError("Type or speak a question first.");
      ask.setValue(text);
      ask.setLoading(true);
      ask.setError("");
      panels.setResult(null);
      try {
        const data = await convertToSql(text);
        panels.setSql(extractSql(data));
        if (hasRows(data) && !Array.isArray(data)) panels.setResult(normalizeResult(data));
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
      head.append(el("p", "answer-q", item.question), copyBtn);
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
    buttonLabel: "Ask PDF",
    loadingLabel: "Reading…",
    onSubmit: async (question) => {
      const text = question.trim();
      if (!uploadState.ready) return ask.setError("Upload a PDF before asking a question.");
      if (!text) return ask.setError("Type or speak a question first.");
      ask.setLoading(true);
      ask.setError("");
      try {
        const data = await askPdf(text, uploadState.fileId);
        history.unshift({ question: text, answer: extractAnswer(data) || "No answer returned.", sources: data?.sources });
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
    onRun: async (sql) => {
      panels.setRunning(true);
      ask.setError("");
      try {
        panels.setResult(normalizeResult(await executeExcelQuery(sql, uploadState.fileId)) ?? { columns: [], rows: [] });
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
    buttonLabel: "Generate Query",
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
      try {
        const data = await askExcel(text, uploadState.fileId);
        panels.setSql(extractSql(data));
        if (hasRows(data)) panels.setResult(normalizeResult(data));
        if (data && typeof data === "object" && data.answer) panels.setAnswer(extractAnswer(data));
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
