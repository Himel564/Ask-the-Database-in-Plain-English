
const LIBS = {
  jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  autotable: "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
};

const loaded = {};
function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { delete loaded[src]; reject(new Error("Could not load " + src)); };
      document.head.append(s);
    });
  }
  return loaded[src];
}

function fileStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function cellText(v) {
  if (v === null || v === undefined) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * data = {
 *   title:    "LinguaSQL answer",
 *   question: "user question",
 *   answer:   "text answer" (optional),
 *   sql:      "generated query" (optional),
 *   source:   "Database: xyz" / "File: abc.pdf" (optional),
 *   table:    { columns: [...], rows: [[...], ...] } (optional)
 * }
 */
export async function downloadPdf(data) {
  const name = `LinguaSQL_${fileStamp()}.pdf`;
  try {
    await loadScript(LIBS.jspdf);
    await loadScript(LIBS.autotable);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const M = 40;
    let y = 0;

    // Header band
    doc.setFillColor(31, 58, 45);
    doc.rect(0, 0, W, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("LinguaSQL", M, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(new Date().toLocaleString(), W - M, 38, { align: "right" });
    y = 92;

    const block = (label, text, opts = {}) => {
      if (!text) return;
      doc.setTextColor(107, 117, 112);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(label.toUpperCase(), M, y);
      y += 14;
      doc.setTextColor(28, 36, 32);
      doc.setFont(opts.mono ? "courier" : "helvetica", "normal");
      doc.setFontSize(opts.mono ? 9.5 : 11);
      const lines = doc.splitTextToSize(text, W - M * 2);
      lines.forEach((line) => {
        if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 50; }
        doc.text(line, M, y);
        y += opts.mono ? 13 : 15;
      });
      y += 12;
    };

    block("Question", data.question);
    block("Answer", data.answer);
    block("Generated query", data.sql, { mono: true });
    block("Source", data.source);

    if (data.table && data.table.columns.length) {
      doc.autoTable({
        startY: y,
        head: [data.table.columns],
        body: data.table.rows.map((r) => r.map(cellText)),
        margin: { left: M, right: M },
        styles: { fontSize: 9, cellPadding: 6, textColor: [28, 36, 32] },
        headStyles: { fillColor: [63, 117, 86], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 246, 242] },
      });
    }

    doc.save(name);
  } catch (e) {
    console.warn("PDF library unavailable, using print fallback.", e);
    printFallback(data);
  }
}

export async function downloadExcel(data) {
  const name = `LinguaSQL_${fileStamp()}`;
  try {
    await loadScript(LIBS.xlsx);
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    if (data.table && data.table.columns.length) {
      const ws = XLSX.utils.aoa_to_sheet([data.table.columns, ...data.table.rows.map((r) => r.map((v) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : v)))]);
      ws["!cols"] = data.table.columns.map((c, i) => ({
        wch: Math.min(50, Math.max(c.length, ...data.table.rows.map((r) => cellText(r[i]).length)) + 2),
      }));
      XLSX.utils.book_append_sheet(wb, ws, "Results");
    }

    const summary = [
      ["Question", data.question || ""],
      ["Answer", data.answer || ""],
      ["Generated query", data.sql || ""],
      ["Source", data.source || ""],
      ["Exported", new Date().toLocaleString()],
    ].filter((r) => r[1]);
    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2["!cols"] = [{ wch: 18 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    XLSX.writeFile(wb, `${name}.xlsx`);
  } catch (e) {
    console.warn("Excel library unavailable, downloading CSV instead.", e);
    const esc = (v) => `"${cellText(v).replace(/"/g, '""')}"`;
    let lines = [];
    if (data.table && data.table.columns.length) {
      lines = [data.table.columns.map(esc).join(","), ...data.table.rows.map((r) => r.map(esc).join(","))];
    } else {
      lines = [["Question", data.question], ["Answer", data.answer]].map((r) => r.map(esc).join(","));
    }
    saveBlob(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
  }
}

function printFallback(data) {
  const esc = (s) => cellText(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const table = data.table && data.table.columns.length
    ? `<table><thead><tr>${data.table.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
       <tbody>${data.table.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : "";
  const w = window.open("", "_blank");
  if (!w) return alert("Please allow pop-ups to download the PDF.");
  w.document.write(`<!doctype html><title>LinguaSQL</title><style>
    body{font-family:Arial,sans-serif;color:#1c2420;margin:32px}
    h1{background:#1f3a2d;color:#fff;padding:14px 18px;border-radius:8px;font-size:20px}
    h4{color:#6b7570;text-transform:uppercase;font-size:11px;margin:18px 0 4px}
    pre{background:#f0f6f2;padding:10px;border-radius:6px;white-space:pre-wrap}
    table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}
    th{background:#3f7556;color:#fff;text-align:left;padding:6px}td{border-bottom:1px solid #e4e8e5;padding:6px}
  </style><h1>LinguaSQL</h1>
  ${data.question ? `<h4>Question</h4><p>${esc(data.question)}</p>` : ""}
  ${data.answer ? `<h4>Answer</h4><p>${esc(data.answer)}</p>` : ""}
  ${data.sql ? `<h4>Generated query</h4><pre>${esc(data.sql)}</pre>` : ""}
  ${data.source ? `<h4>Source</h4><p>${esc(data.source)}</p>` : ""}
  ${table}`);
  w.document.close();
  w.onload = () => w.print();
  setTimeout(() => w.print(), 400);
}