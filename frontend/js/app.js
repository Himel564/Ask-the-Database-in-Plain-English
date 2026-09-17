import { renderIcons } from "./icons.js";
import { checkBackend } from "./api.js";
import { initDatabasePage, initPdfPage, initExcelPage } from "./pages.js";

const MODES = {
  sql: { title: "Ask your database", hint: "Query your database" },
  pdf: { title: "Ask your PDF", hint: "Chat with a document" },
  excel: { title: "Ask your spreadsheet", hint: "Query a spreadsheet" },
};

// Static icons in index.html
renderIcons();

// Build each page once. They stay in the DOM, so switching tabs keeps your work.
initDatabasePage(document.getElementById("page-sql"));
initPdfPage(document.getElementById("page-pdf"));
initExcelPage(document.getElementById("page-excel"));

// ---- Sidebar navigation ----
const sidebar = document.getElementById("sidebar");
const scrim = document.getElementById("scrim");
const navItems = document.querySelectorAll(".nav-item");

function setMenu(open) {
  sidebar.classList.toggle("open", open);
  scrim.hidden = !open;
}

function setMode(mode) {
  Object.keys(MODES).forEach((m) => {
    document.getElementById(`page-${m}`).hidden = m !== mode;
  });
  navItems.forEach((item) => {
    const active = item.dataset.mode === mode;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  document.getElementById("pageTitle").textContent = MODES[mode].title;
  document.getElementById("pageHint").textContent = MODES[mode].hint;
  setMenu(false);
}

navItems.forEach((item) => item.addEventListener("click", () => setMode(item.dataset.mode)));
document.getElementById("openMenu").addEventListener("click", () => setMenu(true));
document.getElementById("closeMenu").addEventListener("click", () => setMenu(false));
scrim.addEventListener("click", () => setMenu(false));

// ---- Backend status ----
const status = document.getElementById("status");
const statusText = document.getElementById("statusText");

async function refreshStatus() {
  const online = await checkBackend();
  status.classList.toggle("off", !online);
  statusText.textContent = online ? "Backend connected" : "Backend offline";
}

refreshStatus();
setInterval(refreshStatus, 30000);
