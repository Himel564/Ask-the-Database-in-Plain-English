import { API } from "./config.js";

async function handle(res) {
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const detail = data?.detail || data?.error || `Request failed with status ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (data && typeof data === "object" && !Array.isArray(data) && data.error) {
    throw new Error(data.error);
  }
  return data;
}

async function request(url, options) {
  try {
    return await handle(await fetch(url, options));
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error("Can't reach the backend. Check that FastAPI is running and VITE_API_BASE_URL in .env is correct.");
    }
    throw e;
  }
}

const postJson = (url, body) =>
  request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const postFile = (url, file) => {
  const form = new FormData();
  form.append("file", file);
  return request(url, { method: "POST", body: form });
};

// Database
export const convertToSql = (question) => postJson(API.convertSql, { question });
export const executeQuery = (query) => postJson(API.executeQuery, { query });

// PDF
export const uploadPdf = (file) => postFile(API.pdfUpload, file);
export const askPdf = (question, fileId) => postJson(API.pdfAsk, { question, file_id: fileId });

// Excel
export const uploadExcel = (file) => postFile(API.excelUpload, file);
export const askExcel = (question, fileId) => postJson(API.excelAsk, { question, file_id: fileId });
export const executeExcelQuery = (query, fileId) => postJson(API.excelExecute, { query, file_id: fileId });

export async function checkBackend() {
  try { await fetch(API.health); return true; } catch { return false; }
}

// ---- Response helpers ----
export function extractSql(data) {
  if (typeof data === "string") return data;
  return data?.sql ?? data?.query ?? data?.sql_query ?? "";
}

export function extractAnswer(data) {
  if (typeof data === "string") return data;
  return data?.answer ?? data?.response ?? data?.message ?? data?.output ?? "";
}

export function extractFileId(data, file) {
  return data?.file_id ?? data?.fileId ?? data?.id ?? data?.filename ?? file?.name ?? null;
}

export function hasRows(data) {
  return !!(data && (Array.isArray(data) || data.result || data.results || data.rows || data.data));
}

// Turns different backend result shapes into { columns, rows }.
export function normalizeResult(data) {
  if (data == null) return null;
  let payload = Array.isArray(data) ? data : data.result ?? data.results ?? data.rows ?? data.data ?? null;
  if (payload == null) return null;

  if (!Array.isArray(payload) && typeof payload === "object") {
    if (Array.isArray(payload.rows) && Array.isArray(payload.columns)) {
      const rows = payload.rows.map((r) =>
        Array.isArray(r) ? Object.fromEntries(payload.columns.map((c, i) => [c, r[i]])) : r
      );
      return { columns: payload.columns, rows };
    }
    return { columns: Object.keys(payload), rows: [payload] };
  }

  if (!Array.isArray(data) && Array.isArray(data.rows) && Array.isArray(data.columns)) {
    return normalizeResult({ result: { columns: data.columns, rows: data.rows } });
  }

  const rows = payload.map((r) => (typeof r === "object" && r !== null ? r : { value: r }));
  return { columns: rows.length ? Object.keys(rows[0]) : [], rows };
}
