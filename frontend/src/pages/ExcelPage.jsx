import { useState } from "react";
import AskCard from "../components/AskCard.jsx";
import FileUpload from "../components/FileUpload.jsx";
import QueryPanels from "../components/QueryPanels.jsx";
import { ExcelIcon } from "../components/Icons.jsx";
import { uploadExcel, askExcel, executeExcelQuery, normalizeResult, extractSql, extractAnswer, hasRows } from "../api.js";
import { useFileUpload } from "./useFileUpload.js";

export default function ExcelPage() {
  const upload = useFileUpload(uploadExcel);
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function generate(q = question) {
    const text = q.trim();
    if (!upload.ready) return setError("Upload an Excel file before asking a question.");
    if (!text) return setError("Type or speak a question first.");
    setQuestion(text);
    setGenerating(true); setError(""); setResult(null); setAnswer("");
    try {
      const data = await askExcel(text, upload.fileId);
      setSql(extractSql(data));
      if (hasRows(data)) setResult(normalizeResult(data));
      if (typeof data === "object" && data?.answer) setAnswer(extractAnswer(data));
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  }

  async function run() {
    setRunning(true); setError("");
    try { setResult(normalizeResult(await executeExcelQuery(sql, upload.fileId)) ?? { columns: [], rows: [] }); }
    catch (e) { setResult(null); setError(e.message); }
    finally { setRunning(false); }
  }

  return (
    <>
      <FileUpload
        title="Upload an Excel file"
        subtitle="Add a spreadsheet, then query its data in plain English."
        accept=".xlsx,.xls,.csv" extensions={[".xlsx", ".xls", ".csv"]} icon={ExcelIcon}
        file={upload.file} status={upload.status} error={upload.error}
        onSelect={upload.select} onUpload={upload.upload}
        onClear={() => { upload.clear(); setSql(""); setResult(null); setAnswer(""); }}
      />

      <AskCard
        subtitle={upload.ready ? `Ask about the data in ${upload.file.name}.` : "Upload an Excel file first to start asking questions."}
        placeholder="e.g. What is the total sales for each region?"
        examples={upload.ready ? ["Show the first 10 rows", "Find the row with the highest value"] : []}
        value={question} onChange={setQuestion} onSubmit={generate}
        loading={generating} buttonLabel="Generate Query" loadingLabel="Generating…"
        disabled={!upload.ready} error={error}
      />

      <QueryPanels
        sql={sql} setSql={setSql} onRun={run} running={running}
        result={result} answer={answer} queryTitle="Generated Query"
      />
    </>
  );
}
