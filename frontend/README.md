# LinguaSQL frontend

## Run
    npm install
    npm run dev
Open http://localhost:5173

## Backend URLs
All endpoints are in `.env`. Restart `npm run dev` after changing it.
The backend must allow CORS from http://localhost:5173.

| Mode  | Endpoint (.env key)            | Request                              | Expected response |
|-------|--------------------------------|--------------------------------------|-------------------|
| SQL   | VITE_CONVERT_SQL_ENDPOINT      | JSON {question}                      | {sql} |
| SQL   | VITE_EXECUTE_QUERY_ENDPOINT    | JSON {query}                         | list of rows |
| PDF   | VITE_PDF_UPLOAD_ENDPOINT       | multipart form, field "file"         | {file_id} |
| PDF   | VITE_PDF_ASK_ENDPOINT          | JSON {question, file_id}             | {answer} |
| Excel | VITE_EXCEL_UPLOAD_ENDPOINT     | multipart form, field "file"         | {file_id} |
| Excel | VITE_EXCEL_ASK_ENDPOINT        | JSON {question, file_id}             | {sql} and/or {result} / {answer} |
| Excel | VITE_EXCEL_EXECUTE_ENDPOINT    | JSON {query, file_id}                | list of rows |

Voice input uses the browser's speech recognition and works in Chrome and Edge.
