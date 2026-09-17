# LinguaSQL frontend (HTML, CSS, JavaScript)

No Node.js, npm or build step.

## Structure
    frontend/
    ├── index.html        page layout and sidebar
    ├── css/styles.css    all styles
    ├── js/
    │   ├── app.js        starts the app, sidebar, backend status
    │   ├── pages.js      SQL, PDF and Excel pages
    │   ├── components.js ask card, query/results panels, file upload
    │   ├── api.js        backend requests
    │   ├── config.js     backend URL and endpoint paths
    │   ├── voice.js      voice input
    │   ├── chart.js      bar chart
    │   ├── icons.js      SVG icons
    │   └── utils.js      small helpers
    ├── nginx.conf
    └── Dockerfile

## Run locally
The page uses JavaScript modules, so it must be served over http (double-clicking index.html won't work).

    cd frontend
    python -m http.server 5173

Open http://localhost:5173 and start the backend with `uvicorn backend.main:app --reload`.
Port 5173 matches the backend's CORS setting.

## Run with Docker
From the project root: `docker compose up -d --build`, then open http://localhost.

## Backend URL
Set automatically in js/config.js: `/api` when served by Nginx, `http://localhost:8000` otherwise.
