import { useRef, useState } from "react";
import { UploadIcon, CloseIcon, CheckIcon } from "./Icons.jsx";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileUpload({ title, subtitle, accept, extensions, icon: Icon, file, status, error, onSelect, onUpload, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function pick(f) {
    if (!f) return;
    const ok = extensions.some((ext) => f.name.toLowerCase().endsWith(ext));
    onSelect(f, ok ? "" : `That file type isn't supported. Choose a ${extensions.join(" or ")} file.`);
  }

  return (
    <section className="card">
      <div>
        <h2 className="card-title">{title}</h2>
        <p className="card-sub">{subtitle}</p>
      </div>

      {!file ? (
        <div
          className={`dropzone ${dragging ? "drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
          role="button"
          tabIndex={0}
        >
          <UploadIcon width={28} height={28} />
          <p><strong>Drop your file here</strong> or click to browse</p>
          <span>{extensions.join(", ")} files</span>
          <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
        </div>
      ) : (
        <div className="file-row">
          <div className="file-icon"><Icon /></div>
          <div className="file-meta">
            <strong title={file.name}>{file.name}</strong>
            <span>
              {formatSize(file.size)}
              {status === "uploaded" && <em className="ok"><CheckIcon width={14} height={14} /> Uploaded</em>}
            </span>
          </div>
          {status !== "uploaded" && (
            <button className="btn btn-green small" onClick={onUpload} disabled={status === "uploading" || !!error}>
              {status === "uploading" ? <span className="spinner" /> : <UploadIcon width={16} height={16} />}
              {status === "uploading" ? "Uploading…" : "Upload"}
            </button>
          )}
          <button className="icon-btn" onClick={onClear} aria-label="Remove file" disabled={status === "uploading"}><CloseIcon /></button>
        </div>
      )}

      {error && <div className="error" role="alert">{error}</div>}
    </section>
  );
}
