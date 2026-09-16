import { useEffect, useState } from "react";
import DatabasePage from "./pages/DatabasePage.jsx";
import PdfPage from "./pages/PdfPage.jsx";
import ExcelPage from "./pages/ExcelPage.jsx";
import { checkBackend } from "./api.js";
import { DatabaseIcon, PdfIcon, ExcelIcon, SparkleIcon, ClockIcon, MicIcon, MenuIcon, CloseIcon } from "./components/Icons.jsx";

const MODES = [
  { id: "sql", label: "SQL Database", hint: "Query your database", icon: DatabaseIcon, title: "Ask your database" },
  { id: "pdf", label: "PDF Upload", hint: "Chat with a document", icon: PdfIcon, title: "Ask your PDF" },
  { id: "excel", label: "Excel Upload", hint: "Query a spreadsheet", icon: ExcelIcon, title: "Ask your spreadsheet" },
];

export default function App() {
  const [mode, setMode] = useState("sql");
  const [online, setOnline] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    checkBackend().then(setOnline);
    const timer = setInterval(() => checkBackend().then(setOnline), 30000);
    return () => clearInterval(timer);
  }, []);

  const current = MODES.find((m) => m.id === mode);

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><DatabaseIcon width={22} height={22} /></div>
          <div>
            <h1>LinguaSQL</h1>
            <p>Natural Language → SQL</p>
          </div>
          <button className="icon-btn plain close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><CloseIcon /></button>
        </div>

        <nav className="nav" aria-label="Data sources">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`nav-item ${mode === m.id ? "active" : ""}`}
              onClick={() => { setMode(m.id); setMenuOpen(false); }}
              aria-current={mode === m.id ? "page" : undefined}
            >
              <m.icon />
              <span>
                <strong>{m.label}</strong>
                <small>{m.hint}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className={`status ${online === false ? "off" : ""}`}>
          <span className="dot" />
          {online === null ? "Checking connection" : online ? "Backend connected" : "Backend offline"}
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn plain open-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><MenuIcon /></button>
          <div>
            <h2>{current.title}</h2>
            <p>{current.hint}</p>
          </div>
        </header>

        <main className="container">
          {/* All pages stay mounted so switching tabs keeps your work */}
          <div hidden={mode !== "sql"} className="page-stack"><DatabasePage /></div>
          <div hidden={mode !== "pdf"} className="page-stack"><PdfPage /></div>
          <div hidden={mode !== "excel"} className="page-stack"><ExcelPage /></div>

          <div className="features">
            <div className="feature"><SparkleIcon /><div><h3>Natural language</h3><p>Ask questions without knowing SQL.</p></div></div>
            <div className="feature"><MicIcon /><div><h3>Voice input</h3><p>Speak your question instead of typing.</p></div></div>
            <div className="feature"><ClockIcon /><div><h3>Fast results</h3><p>Run queries and inspect results instantly.</p></div></div>
          </div>
        </main>

        <footer className="footer">LinguaSQL frontend, built with React and Vite</footer>
      </div>
    </div>
  );
}
