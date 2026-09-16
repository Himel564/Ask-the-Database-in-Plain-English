import { useState } from "react";
import { extractFileId } from "../api.js";

export function useFileUpload(uploadFn) {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | uploaded
  const [error, setError] = useState("");

  function select(f, validationError) {
    setFile(f); setFileId(null); setStatus("idle"); setError(validationError);
  }

  async function upload() {
    if (!file) return;
    setStatus("uploading"); setError("");
    try {
      const data = await uploadFn(file);
      setFileId(extractFileId(data, file));
      setStatus("uploaded");
    } catch (e) {
      setStatus("idle"); setError(e.message);
    }
  }

  function clear() {
    setFile(null); setFileId(null); setStatus("idle"); setError("");
  }

  return { file, fileId, status, error, select, upload, clear, ready: status === "uploaded" };
}
