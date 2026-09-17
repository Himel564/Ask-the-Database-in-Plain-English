import { icon } from "./icons.js";
import { el, html, spinner, copyText } from "./utils.js";
import { createVoiceInput } from "./voice.js";
import { speakText, stopSpeaking } from "./speak.js";
import { renderChart, renderPieChart } from "./chart.js";

let uid = 0;

// ---------------------------------------------------------------------------
// Ask card: question box, voice button, voice-to-voice button, examples,
// submit button, error box
// ---------------------------------------------------------------------------
export function createAskCard({
  subtitle,
  placeholder,
  examples = [],
  buttonLabel,
  loadingLabel,
  onSubmit
}) {
  const id = `question-${++uid}`;

  const card = html(`
    <section class="card ask">
      <label for="${id}" class="card-title">Ask a question</label>
      <p class="card-sub"></p>

      <div class="input-wrap">
        <textarea id="${id}" rows="4" style="padding-right: 116px;"></textarea>

        <button
          type="button"
          class="mic-btn"
          style="right: 62px;"
          aria-label="Ask with your voice"
          title="Ask with your voice"
        >
          ${icon("mic", 18)}
        </button>

        <button
          type="button"
          class="mic-btn wave-btn"
          style="right: 12px; background: #2563eb; border-color: #2563eb; color: #fff;"
          aria-label="Talk and hear the answer"
          title="Talk and hear the answer"
        >
          ${icon("wave", 18)}
        </button>
      </div>

      <p class="listening-note" hidden>
        <span class="pulse"></span>
        Listening. Press stop when you're done.
      </p>

      <div class="ask-footer">
        <p class="try"></p>
        <button class="btn btn-dark submit-btn"></button>
      </div>

      <div class="error" role="alert" hidden></div>
    </section>
  `);

  const textarea = card.querySelector("textarea");
  const sub = card.querySelector(".card-sub");
  const wrap = card.querySelector(".input-wrap");
  const micBtn = card.querySelector(".mic-btn");
  const waveBtn = card.querySelector(".wave-btn");
  const note = card.querySelector(".listening-note");
  const tryBox = card.querySelector(".try");
  const submitBtn = card.querySelector(".submit-btn");
  const errorBox = card.querySelector(".error");

  let listening = false;
  let loading = false;
  let disabled = false;

  // Used to determine whether the answer should be spoken automatically.
  let usedVoice = false;

  // Tracks whether the voice-to-voice button is currently listening.
  let waveListening = false;

  textarea.placeholder = placeholder;

  // -------------------------------------------------------------------------
  // Normal voice input: voice -> text
  // -------------------------------------------------------------------------
  const voice = createVoiceInput({
    onText: (text) => {
      textarea.value = text;
    },

    onListeningChange: (on) => {
      listening = on;

      wrap.classList.toggle("listening", on);
      micBtn.classList.toggle("on", on);

      micBtn.innerHTML = icon(on ? "stop" : "mic", 18);

      micBtn.setAttribute(
        "aria-label",
        on ? "Stop voice input" : "Ask with your voice"
      );

      note.hidden = !on;

      textarea.placeholder = on
        ? "Listening… speak your question"
        : placeholder;
    },

    onError: (msg) => setError(msg),
  });

  micBtn.addEventListener("click", () => {
    listening
      ? voice.stop()
      : voice.start(textarea.value);
  });

  // -------------------------------------------------------------------------
  // Voice-to-voice input
  // Voice -> Question -> Submit -> Answer -> Speech
  // -------------------------------------------------------------------------
  const waveVoice = createVoiceInput({
    onText: (text) => {
      textarea.value = text;
    },

    onListeningChange: (on) => {
      const wasListening = waveListening;

      waveListening = on;

      wrap.classList.toggle("listening", on);
      waveBtn.classList.toggle("on", on);

      waveBtn.innerHTML = icon(on ? "stop" : "wave", 18);

      // Blue = ready
      // Red = currently listening
      waveBtn.style.background = on ? "#dc2626" : "#2563eb";
      waveBtn.style.borderColor = on ? "#dc2626" : "#2563eb";

      note.hidden = !on;

      textarea.placeholder = on
        ? "Listening… speak your question"
        : placeholder;

      // When listening stops, automatically submit the question.
      if (wasListening && !on && textarea.value.trim()) {
        usedVoice = true;
        onSubmit(textarea.value);
      }
    },

    onError: (msg) => setError(msg),
  });

  // Start/stop voice-to-voice mode.
  waveBtn.addEventListener("click", () => {
    if (waveListening) {
      waveVoice.stop();
    } else {
      // Stop any previous answer that may still be speaking.
      stopSpeaking();

      // Start a fresh voice question.
      textarea.value = "";

      waveVoice.start("");
    }
  });

  // If the user types manually, it is no longer considered
  // a voice-to-voice question.
  textarea.addEventListener("input", () => {
    usedVoice = false;
  });

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  submitBtn.addEventListener("click", () => {
    onSubmit(textarea.value);
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      onSubmit(textarea.value);
    }
  });

  // -------------------------------------------------------------------------
  // Submit button
  // -------------------------------------------------------------------------
  function renderButton() {
    submitBtn.disabled = loading || disabled;

    // Keep the second file's spinner behavior.
    submitBtn.innerHTML = `
      ${loading ? spinner : icon("sparkle")}
      <span></span>
    `;

    submitBtn.querySelector("span").textContent =
      loading ? loadingLabel : buttonLabel;
  }

  // -------------------------------------------------------------------------
  // Example questions
  // -------------------------------------------------------------------------
  function setExamples(list) {
    tryBox.innerHTML = "";

    if (!list.length) return;

    tryBox.append("Try: ");

    list.forEach((ex, i) => {
      const link = el("button", "link", ex);

      link.addEventListener("click", () => {
        textarea.value = ex;

        // Example questions are normal text questions,
        // so their answers should not automatically be spoken.
        usedVoice = false;

        onSubmit(ex);
      });

      tryBox.append(link);

      if (i < list.length - 1) {
        tryBox.append(", ");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Automatically speak the answer for voice-to-voice questions.
  // -------------------------------------------------------------------------
  function setSpeech(text) {
    if (!text) {
      stopSpeaking();
    } else if (usedVoice) {
      speakText(text);
    }
  }

  // -------------------------------------------------------------------------
  // Error
  // -------------------------------------------------------------------------
  function setError(msg) {
    errorBox.textContent = msg || "";
    errorBox.hidden = !msg;
  }

  sub.textContent = subtitle;

  setExamples(examples);
  renderButton();

  return {
    element: card,

    getValue: () => textarea.value,

    setValue: (v) => {
      textarea.value = v;
    },

    setLoading: (v) => {
      loading = v;
      renderButton();
    },

    setDisabled: (v) => {
      disabled = v;

      renderButton();

      tryBox
        .querySelectorAll("button")
        .forEach((b) => (b.disabled = v));
    },

    setSubtitle: (text) => {
      sub.textContent = text;
    },

    setExamples,

    setError,

    // Used by the page to provide the generated answer.
    // If the question came from voice-to-voice mode,
    // the answer will automatically be spoken.
    setSpeech,
  };
}


// ---------------------------------------------------------------------------
// Generated query panel + results panel
// Supports:
// - Table
// - Normal chart
// - Pie chart
// - Optional hidden Run Query button
// ---------------------------------------------------------------------------
export function createQueryPanels({
  queryTitle = "Generated SQL",
  onRun,
  hideRunButton = false
}) {
  const grid = html(`
    <div class="grid">

      <section class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title"></h2>
            <p class="card-sub">Review the query before execution</p>
          </div>

          <button
            class="icon-btn copy-btn"
            aria-label="Copy query"
            disabled
          >
            ${icon("copy")}
          </button>
        </div>

        <textarea
          class="code"
          placeholder="Your query will appear here."
          spellcheck="false"
        ></textarea>

        <button class="btn btn-green run-btn" disabled></button>
      </section>


      <section class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Query Results</h2>

            <p class="card-sub result-count">
              Run a query to see results
            </p>
          </div>

          <div class="view-toggle">

            <button
              class="icon-btn plain active"
              data-view="table"
              aria-label="Table view"
            >
              ${icon("table")}
            </button>

            <button
              class="icon-btn plain"
              data-view="chart"
              aria-label="Chart view"
            >
              ${icon("chart")}
            </button>

            <button
              class="icon-btn plain"
              data-view="pie"
              aria-label="Pie chart view"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
              </svg>
            </button>

          </div>
        </div>

        <div class="answer-inline" hidden></div>

        <div class="result-body"></div>
      </section>

    </div>
  `);

  grid.querySelector(".card-title").textContent = queryTitle;

  const code = grid.querySelector(".code");
  const copyBtn = grid.querySelector(".copy-btn");
  const runBtn = grid.querySelector(".run-btn");
  const countText = grid.querySelector(".result-count");
  const answerBox = grid.querySelector(".answer-inline");
  const body = grid.querySelector(".result-body");
  const viewButtons = grid.querySelectorAll("[data-view]");

  // Hide Run Query when requested.
  if (hideRunButton) {
    runBtn.hidden = true;
  }

  let result = null;
  let answer = "";
  let view = "table";
  let running = false;

  // -------------------------------------------------------------------------
  // Run button
  // -------------------------------------------------------------------------
  function renderRunButton() {
    runBtn.disabled = running || !code.value.trim();

    runBtn.innerHTML = `
      ${running ? spinner : icon("play")}
      <span></span>
    `;

    runBtn.querySelector("span").textContent =
      running ? "Running…" : "Run Query";

    copyBtn.disabled = !code.value;
  }

  // -------------------------------------------------------------------------
  // Table cell formatting
  // -------------------------------------------------------------------------
  function formatCell(td, value) {
    if (value === null || value === undefined) {
      td.append(el("span", "null", "null"));
    } else if (typeof value === "object") {
      td.textContent = JSON.stringify(value);
    } else {
      td.textContent = String(value);
    }
  }

  // -------------------------------------------------------------------------
  // Render results
  // -------------------------------------------------------------------------
  function renderResults() {
    const rowCount = result?.rows?.length ?? 0;

    countText.textContent = result
      ? `${rowCount} ${rowCount === 1 ? "row" : "rows"} returned`
      : "Run a query to see results";

    answerBox.hidden = !answer;
    answerBox.textContent = answer;

    body.innerHTML = "";

    // No result yet.
    if (!result) {
      const emptyText = hideRunButton
        ? "No results yet. Ask a question and press Generate Answer."
        : "No results yet. Generate a query and press Run Query.";

      if (!answer) {
        body.append(el("div", "empty", emptyText));
      }

      return;
    }

    // Query returned zero rows.
    if (rowCount === 0) {
      body.append(
        el(
          "div",
          "empty",
          "The query ran but returned no rows."
        )
      );

      return;
    }

    // -----------------------------------------------------------------------
    // Normal chart
    // -----------------------------------------------------------------------
    if (view === "chart") {
      renderChart(body, result);
      return;
    }

    // -----------------------------------------------------------------------
    // Pie chart
    // -----------------------------------------------------------------------
    if (view === "pie") {
      renderPieChart(body, result);
      return;
    }

    // -----------------------------------------------------------------------
    // Table
    // -----------------------------------------------------------------------
    const wrap = el("div", "table-wrap");
    const table = el("table");

    const headRow = el("tr");

    result.columns.forEach((c) => {
      headRow.append(
        el("th", "", c.replace(/_/g, " "))
      );
    });

    const thead = el("thead");
    thead.append(headRow);

    const tbody = el("tbody");

    result.rows.forEach((row) => {
      const tr = el("tr");

      result.columns.forEach((c) => {
        const td = el(
          "td",
          typeof row[c] === "number" ? "num" : ""
        );

        formatCell(td, row[c]);

        tr.append(td);
      });

      tbody.append(tr);
    });

    table.append(thead, tbody);
    wrap.append(table);
    body.append(wrap);
  }

  // -------------------------------------------------------------------------
  // Query textarea
  // -------------------------------------------------------------------------
  code.addEventListener("input", renderRunButton);

  // -------------------------------------------------------------------------
  // Run query
  // -------------------------------------------------------------------------
  runBtn.addEventListener("click", () => {
    onRun(code.value);
  });

  // -------------------------------------------------------------------------
  // Copy query
  // -------------------------------------------------------------------------
  copyBtn.addEventListener("click", async () => {
    if (!code.value) return;

    if (await copyText(code.value)) {
      copyBtn.innerHTML = icon("check");

      setTimeout(() => {
        copyBtn.innerHTML = icon("copy");
      }, 1500);
    }
  });

  // -------------------------------------------------------------------------
  // Table / chart / pie view switching
  // -------------------------------------------------------------------------
  viewButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      view = btn.dataset.view;

      viewButtons.forEach((b) =>
        b.classList.toggle("active", b === btn)
      );

      renderResults();
    })
  );

  renderRunButton();
  renderResults();

  return {
    element: grid,

    getSql: () => code.value,

    setSql: (sql) => {
      code.value = sql || "";
      renderRunButton();
    },

    setRunning: (v) => {
      running = v;
      renderRunButton();
    },

    setResult: (r) => {
      result = r;
      renderResults();
    },

    setAnswer: (a) => {
      answer = a || "";
      renderResults();
    },

    clear: () => {
      code.value = "";
      result = null;
      answer = "";

      renderRunButton();
      renderResults();
    },
  };
}


// ---------------------------------------------------------------------------
// File upload card
// ---------------------------------------------------------------------------
function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function createFileUpload({
  title,
  subtitle,
  accept,
  extensions,
  iconName,
  uploadFn,
  getFileId,
  onChange
}) {
  const card = html(`
    <section class="card">
      <div>
        <h2 class="card-title"></h2>
        <p class="card-sub"></p>
      </div>

      <div class="upload-body"></div>

      <div
        class="error"
        role="alert"
        hidden
      ></div>
    </section>
  `);

  card.querySelector(".card-title").textContent = title;
  card.querySelector(".card-sub").textContent = subtitle;

  const bodyBox = card.querySelector(".upload-body");
  const errorBox = card.querySelector(".error");

  const state = {
    file: null,
    fileId: null,
    status: "idle",
    error: ""
  };

  // -------------------------------------------------------------------------
  // State update
  // -------------------------------------------------------------------------
  function update(patch) {
    Object.assign(state, patch);

    render();

    onChange?.({
      ...state,
      ready: state.status === "uploaded"
    });
  }

  // -------------------------------------------------------------------------
  // Pick file
  // -------------------------------------------------------------------------
  function pick(file) {
    if (!file) return;

    const ok = extensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    update({
      file,
      fileId: null,
      status: "idle",
      error: ok
        ? ""
        : `That file type isn't supported. Choose a ${extensions.join(
            " or "
          )} file.`
    });
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------
  async function upload() {
    if (!state.file) return;

    update({
      status: "uploading",
      error: ""
    });

    try {
      const data = await uploadFn(state.file);

      update({
        fileId: getFileId(data, state.file),
        status: "uploaded"
      });
    } catch (e) {
      update({
        status: "idle",
        error: e.message
      });
    }
  }

  // -------------------------------------------------------------------------
  // Drop zone
  // -------------------------------------------------------------------------
  function renderDropzone() {
    const zone = html(`
      <div
        class="dropzone"
        role="button"
        tabindex="0"
      >
        ${icon("upload", 28)}

        <p>
          <strong>Drop your file here</strong>
          or click to browse
        </p>

        <span></span>

        <input
          type="file"
          hidden
        />
      </div>
    `);

    zone.querySelector("span").textContent =
      `${extensions.join(", ")} files`;

    const input = zone.querySelector("input");

    input.accept = accept;

    zone.addEventListener("click", () => input.click());

    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();

      zone.classList.remove("drag");

      pick(e.dataTransfer.files[0]);
    });

    input.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    input.addEventListener("change", () => {
      pick(input.files[0]);
      input.value = "";
    });

    return zone;
  }

  // -------------------------------------------------------------------------
  // File row
  // -------------------------------------------------------------------------
  function renderFileRow() {
    const row = html(`
      <div class="file-row">
        <div class="file-icon">
          ${icon(iconName)}
        </div>

        <div class="file-meta">
          <strong></strong>
          <span class="file-size"></span>
        </div>
      </div>
    `);

    const name = row.querySelector("strong");

    name.textContent = state.file.name;
    name.title = state.file.name;

    const size = row.querySelector(".file-size");

    size.textContent = formatSize(state.file.size);

    if (state.status === "uploaded") {
      size.insertAdjacentHTML(
        "beforeend",
        ` <em class="ok">${icon("check", 14)} Uploaded</em>`
      );
    }

    // Upload button
    if (state.status !== "uploaded") {
      const uploading = state.status === "uploading";

      const btn = el(
        "button",
        "btn btn-green small"
      );

      btn.innerHTML = `
        ${uploading ? spinner : icon("upload", 16)}
        <span></span>
      `;

      btn.querySelector("span").textContent =
        uploading ? "Uploading…" : "Upload";

      btn.disabled = uploading || !!state.error;

      btn.addEventListener("click", upload);

      row.append(btn);
    }

    // Remove button
    const removeBtn = el(
      "button",
      "icon-btn"
    );

    removeBtn.innerHTML = icon("close");

    removeBtn.setAttribute(
      "aria-label",
      "Remove file"
    );

    removeBtn.disabled =
      state.status === "uploading";

    removeBtn.addEventListener("click", () =>
      update({
        file: null,
        fileId: null,
        status: "idle",
        error: ""
      })
    );

    row.append(removeBtn);

    return row;
  }

  // -------------------------------------------------------------------------
  // Render upload card
  // -------------------------------------------------------------------------
  function render() {
    bodyBox.innerHTML = "";

    bodyBox.append(
      state.file
        ? renderFileRow()
        : renderDropzone()
    );

    errorBox.textContent = state.error;
    errorBox.hidden = !state.error;
  }

  render();

  return {
    element: card,

    getState: () => ({
      ...state,
      ready: state.status === "uploaded"
    })
  };
}

