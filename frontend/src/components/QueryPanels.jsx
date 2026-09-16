import { useState } from "react";
import ResultsChart from "./ResultsChart.jsx";
import { CopyIcon, CheckIcon, PlayIcon, TableIcon, ChartIcon } from "./Icons.jsx";

function formatCell(value) {
  if (value === null || value === undefined) return <span className="null">null</span>;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function QueryPanels({ sql, setSql, onRun, running, result, queryTitle = "Generated SQL", answer }) {
  const [view, setView] = useState("table");
  const [copied, setCopied] = useState(false);
  const rowCount = result?.rows?.length ?? 0;

  async function copy() {
    if (!sql) return;
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">{queryTitle}</h2>
            <p className="card-sub">Review the query before execution</p>
          </div>
          <button className="icon-btn" onClick={copy} disabled={!sql} aria-label="Copy query">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
        <textarea
          className="code"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="Your query will appear here."
          spellCheck={false}
        />
        <button className="btn btn-green" onClick={onRun} disabled={!sql.trim() || running}>
          {running ? <span className="spinner" /> : <PlayIcon />}
          {running ? "Running…" : "Run Query"}
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Query Results</h2>
            <p className="card-sub">
              {result ? `${rowCount} ${rowCount === 1 ? "row" : "rows"} returned` : "Run a query to see results"}
            </p>
          </div>
          <div className="view-toggle">
            <button className={`icon-btn plain ${view === "table" ? "active" : ""}`} onClick={() => setView("table")} aria-label="Table view"><TableIcon /></button>
            <button className={`icon-btn plain ${view === "chart" ? "active" : ""}`} onClick={() => setView("chart")} aria-label="Chart view"><ChartIcon /></button>
          </div>
        </div>

        {answer && <div className="answer-inline">{answer}</div>}

        {!result && !answer && <div className="empty">No results yet. Generate a query and press Run Query.</div>}
        {result && rowCount === 0 && <div className="empty">The query ran but returned no rows.</div>}

        {result && rowCount > 0 && view === "table" && (
          <div className="table-wrap">
            <table>
              <thead><tr>{result.columns.map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {result.columns.map((c) => (
                      <td key={c} className={typeof row[c] === "number" ? "num" : ""}>{formatCell(row[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && rowCount > 0 && view === "chart" && <ResultsChart columns={result.columns} rows={result.rows} />}
      </section>
    </div>
  );
}
