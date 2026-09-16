import { useSpeechInput } from "../hooks.js";
import { MicIcon, StopIcon, SparkleIcon } from "./Icons.jsx";

export default function AskCard({
  title = "Ask a question", subtitle, placeholder, examples = [],
  value, onChange, onSubmit, loading, buttonLabel, loadingLabel, disabled, error,
}) {
  const { listening, start, stop, speechError } = useSpeechInput(onChange);

  return (
    <section className="card ask">
      <label htmlFor="question" className="card-title">{title}</label>
      {subtitle && <p className="card-sub">{subtitle}</p>}

      <div className={`input-wrap ${listening ? "listening" : ""}`}>
        <textarea
          id="question"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit(); }}
          placeholder={listening ? "Listening… speak your question" : placeholder}
          rows={4}
        />
        <button
          type="button"
          className={`mic-btn ${listening ? "on" : ""}`}
          onClick={() => (listening ? stop() : start(value))}
          aria-label={listening ? "Stop voice input" : "Ask with your voice"}
          title={listening ? "Stop" : "Ask with your voice"}
        >
          {listening ? <StopIcon width={18} height={18} /> : <MicIcon width={18} height={18} />}
        </button>
      </div>
      {listening && <p className="listening-note"><span className="pulse" /> Listening. Press stop when you're done.</p>}

      <div className="ask-footer">
        {examples.length > 0 ? (
          <p className="try">
            Try:{" "}
            {examples.map((ex, i) => (
              <span key={ex}>
                <button className="link" onClick={() => onSubmit(ex)} disabled={disabled}>{ex}</button>
                {i < examples.length - 1 && ", "}
              </span>
            ))}
          </p>
        ) : <span />}
        <button className="btn btn-dark" onClick={() => onSubmit()} disabled={loading || disabled}>
          {loading ? <span className="spinner" /> : <SparkleIcon />}
          {loading ? loadingLabel : buttonLabel}
        </button>
      </div>

      {(error || speechError) && <div className="error" role="alert">{error || speechError}</div>}
    </section>
  );
}
