// Backend settings. This replaces the old .env file.
//
// API_BASE_URL is picked automatically:
//   - Served by Nginx in Docker (http://localhost or your AWS server): "/api"
//     Nginx forwards /api/... to the backend container.
//   - Served locally on another port (e.g. http://localhost:5173): "http://localhost:8000"
// To force a value, set API_BASE_URL_OVERRIDE below.

const API_BASE_URL_OVERRIDE = "/api";

const servedByNginx = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
const API_BASE_URL = (API_BASE_URL_OVERRIDE || (servedByNginx ? "/api" : "http://localhost:8000")).replace(/\/$/, "");

const ENDPOINTS = {
  health: "/health",
  convertSql: "/convert_to_sql",
  executeQuery: "/execute_query",
  evaluateSql: "/evaluate_sql",

  pdfUpload: "/upload_pdf",
  pdfAsk: "/ask_pdf",

  excelUpload: "/upload_excel",
  excelAsk: "/ask_excel",
  excelExecute: "/execute_excel_query",
};

export const API = Object.fromEntries(
  Object.entries(ENDPOINTS).map(([key, path]) => [key, API_BASE_URL + path])
);