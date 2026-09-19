

const API_BASE_URL_OVERRIDE = "/api";

const servedByNginx = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
const API_BASE_URL = (API_BASE_URL_OVERRIDE || (servedByNginx ? "/api" : "http://localhost:8000")).replace(/\/$/, "");

const ENDPOINTS = {
  health: "/health",
  convertSql: "/convert_to_sql",
  executeQuery: "/execute_query",
  askWithChart: "/ask_with_chart", // NEW: smart charts
  evaluateSql: "/evaluate_sql",

  pdfUpload: "/upload_pdf",
  pdfAsk: "/ask_pdf",

  excelUpload: "/upload_excel",
  excelAsk: "/ask_excel",
  excelExecute: "/execute_excel_query",

  // NEW: multilingual
  transcribeAudio: "/transcribe_audio",
  replyInLanguage: "/reply_in_user_language",
  speakText: "/speak_text",
};

export const API = Object.fromEntries(
  Object.entries(ENDPOINTS).map(([key, path]) => [key, API_BASE_URL + path])
);