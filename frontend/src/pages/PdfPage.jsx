import { useState } from "react";
import AskCard from "../components/AskCard.jsx";
import FileUpload from "../components/FileUpload.jsx";
import { PdfIcon, CopyIcon, CheckIcon } from "../components/Icons.jsx";
import { uploadPdf, askPdf, extractAnswer } from "../api.js";
import { useFileUpload } from "./useFileUpload.js";

export default function PdfPage() {
  const upload = useFileUpload(uploadPdf);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);

  async function ask(q = question) {
    const text = q.trim();
    if (!upload.ready) return setError("Upload a PDF before asking a question.");
    if (!text) return setError("Type or speak a question first.");
    setQuestion(text);
    setLoading(true); setError("");
    try {
      const data = await askPdf(text, upload.fileId);
      setHistory((h) => [{ question: text, answer: extractAnswer(data) || "No answer returned.", sources: data?.sources }, ...h]);
      setQuestion("");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function copy(text, i) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  return (
    <>
      <FileUpload
        title="Upload a PDF"
        subtitle="Add a document, then ask questions about what's inside it."
        accept="application/pdf,.pdf" extensions={[".pdf"]} icon={PdfIcon}
        file={upload.file} status={upload.status} error={upload.error}
        onSelect={upload.select} onUpload={upload.upload} onClear={() => { upload.clear(); setHistory([]); }}
      />

      <AskCard
        subtitle={upload.ready ? `Ask anything about ${upload.file.name}.` : "Upload a PDF first to start asking questions."}
        placeholder="e.g. Summarize the key points of this document"
        examples={upload.ready ? ["Summarize this document", "List the important dates mentioned"] : []}
        value={question} onChange={setQuestion} onSubmit={ask}
        loading={loading} buttonLabel="Ask PDF" loadingLabel="Reading…"
        disabled={!upload.ready} error={error}
      />

      <section className="card">
        <div>
          <h2 className="card-title">Answers</h2>
          <p className="card-sub">{history.length ? `${history.length} ${history.length === 1 ? "answer" : "answers"}` : "Answers from your document appear here"}</p>
        </div>
        {history.length === 0 ? (
          <div className="empty">No answers yet. Upload a PDF and ask a question.</div>
        ) : (
          <div className="answers">
            {history.map((item, i) => (
              <article className="answer" key={history.length - i}>
                <div className="answer-head">
                  <p className="answer-q">{item.question}</p>
                  <button className="icon-btn plain" onClick={() => copy(item.answer, i)} aria-label="Copy answer">
                    {copiedIndex === i ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
                <p className="answer-a">{item.answer}</p>
                {Array.isArray(item.sources) && item.sources.length > 0 && (
                  <p className="answer-src">Sources: {item.sources.map((s) => (typeof s === "object" ? s.page ?? JSON.stringify(s) : s)).join(", ")}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
