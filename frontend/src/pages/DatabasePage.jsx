import { useState } from "react";
import AskCard from "../components/AskCard.jsx";
import QueryPanels from "../components/QueryPanels.jsx";
import { convertToSql, executeQuery, normalizeResult, extractSql, hasRows } from "../api.js";

const EXAMPLES = [
  "Give the number of employees in the company",
  "Find the second highest salary with employee details",
];

export default function DatabasePage() {
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function generate(q = question) {
    const text = q.trim();
    if (!text) return setError("Type or speak a question first.");
    setQuestion(text);
    setGenerating(true); setError(""); setResult(null);
    try {
      const data = await convertToSql(text);
      setSql(extractSql(data));
      if (hasRows(data) && !Array.isArray(data)) setResult(normalizeResult(data));
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  }

  async function run() {
    setRunning(true); setError("");
    try { setResult(normalizeResult(await executeQuery(sql)) ?? { columns: [], rows: [] }); }
    catch (e) { setResult(null); setError(e.message); }
    finally { setRunning(false); }
  }

  return (
    <>
      <AskCard
        subtitle="Describe what you want to know about your database in plain English, or use the mic."
        placeholder="e.g. Give the number of employees in the company"
        examples={EXAMPLES}
        value={question} onChange={setQuestion} onSubmit={generate}
        loading={generating} buttonLabel="Generate SQL" loadingLabel="Generating…"
        error={error}
      />
      <QueryPanels sql={sql} setSql={setSql} onRun={run} running={running} result={result} />
    </>
  );
}
