// Every backend URL comes from .env. Restart `npm run dev` after editing .env.
const env = import.meta.env;
const base = (env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const url = (path, fallback) => `${base}${path || fallback}`;

export const API = {
  health: url(env.VITE_HEALTH_ENDPOINT, "/health"),
  convertSql: url(env.VITE_CONVERT_SQL_ENDPOINT, "/convert_to_sql"),
  executeQuery: url(env.VITE_EXECUTE_QUERY_ENDPOINT, "/execute_query"),
  pdfUpload: url(env.VITE_PDF_UPLOAD_ENDPOINT, "/upload_pdf"),
  pdfAsk: url(env.VITE_PDF_ASK_ENDPOINT, "/ask_pdf"),
  excelUpload: url(env.VITE_EXCEL_UPLOAD_ENDPOINT, "/upload_excel"),
  excelAsk: url(env.VITE_EXCEL_ASK_ENDPOINT, "/ask_excel"),
  excelExecute: url(env.VITE_EXCEL_EXECUTE_ENDPOINT, "/execute_excel_query"),
};
