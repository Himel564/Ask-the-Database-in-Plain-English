// NEW FILE: smart charts for the Ask Database page only.
// Draws bar / pie / line charts as SVG using the columns the backend chose.
// The Excel / PDF / Evaluation pages keep using chart.js exactly as before.

import { el } from "./utils.js";

// New palette (different from the existing bar / pie colours)
const SMART_COLORS = [
  "#0e7490", // deep cyan
  "#e8604c", // coral
  "#7c5cd6", // iris
  "#f2a93b", // saffron
  "#2f9e6e", // jade
  "#d6457e", // raspberry
  "#3d6fd9", // cobalt
  "#9a7b4f", // bronze
  "#18a3b8", // lagoon
  "#b14fc5", // orchid
];
const LINE_COLOR = "#7c5cd6";

const isNum = (v) => v !== null && v !== "" && typeof v !== "boolean" && !isNaN(Number(v));

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtNum(v) {
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Short number for axis ticks: 1.2K, 3.4M
function shortNum(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "K";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// "2023-01-01T00:00:00" -> "2023-01-01"
function fmtLabel(v) {
  if (v === null || v === undefined) return "—";
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00/);
  return m ? m[1] : s;
}

function niceMax(max) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= max) * pow;
  return step * 4;
}

// Use the backend's columns; if missing, guess like chart.js does.
function resolveColumns({ columns, rows }, spec) {
  let x = spec?.x, y = spec?.y;
  if (!columns.includes(y) || !rows.every((r) => r[y] === null || isNum(r[y]))) {
    y = columns.find((c) => rows.every((r) => isNum(r[c])) && !/(^id$|_id$)/i.test(c)) ??
        columns.find((c) => rows.every((r) => isNum(r[c])));
  }
  if (!columns.includes(x) || x === y) {
    x = columns.find((c) => c !== y && !rows.every((r) => isNum(r[c]))) ??
        columns.find((c) => c !== y) ?? null;
  }
  return { x, y };
}

function injectStyles() {
  if (document.getElementById("smart-chart-styles")) return;
  const style = document.createElement("style");
  style.id = "smart-chart-styles";
  style.textContent = `
    .smart-chart { padding: 8px 4px 4px; }
    .smart-chart .chart-caption { margin: 0 0 10px; font-size: 13px; opacity: .75; }
    .smart-chart .sc-scroll { overflow-x: auto; }
    .smart-chart svg { display: block; max-width: 100%; height: auto; }
    .smart-chart svg text { fill: currentColor; font-size: 11px; }
    .smart-chart .sc-grid { stroke: currentColor; opacity: .12; }
    .smart-chart .sc-axis { stroke: currentColor; opacity: .35; }
    .smart-chart .sc-val { font-weight: 600; }
    .smart-chart .sc-bar, .smart-chart .sc-slice, .smart-chart .sc-dot { transition: opacity .15s; }
    .smart-chart .sc-bar:hover, .smart-chart .sc-slice:hover { opacity: .8; }
    .smart-chart .sc-pie { display: flex; flex-wrap: wrap; align-items: center; gap: 24px; }
    .smart-chart .sc-legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13px; }
    .smart-chart .sc-legend li { display: flex; align-items: center; gap: 8px; }
    .smart-chart .sc-sw { width: 12px; height: 12px; border-radius: 3px; flex: none; }
    .smart-chart .sc-pct { opacity: .6; }
    .view-toggle [data-view].sc-suggested { position: relative; }
    .view-toggle [data-view].sc-suggested::after {
      content: ""; position: absolute; top: 3px; right: 3px; width: 7px; height: 7px;
      border-radius: 50%; background: #e8604c; box-shadow: 0 0 0 2px var(--surface, #fff);
    }
    .view-toggle [data-view].sc-dim { opacity: .4; }
  `;
  document.head.append(style);
}

// ---------------------------------------------------------------------------
// Bar chart (vertical)
// ---------------------------------------------------------------------------
function drawBar(data, yName) {
  const n = data.length;
  const slot = Math.max(38, Math.min(80, 640 / n));
  const padL = 48, padR = 12, padT = 22;
  const rotate = n > 6 || data.some((d) => d.label.length > 10);
  const padB = rotate ? 78 : 36;
  const W = padL + padR + slot * n, H = 280;
  const plotH = H - padT - padB;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const barW = slot * 0.62;

  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, yy = padT + plotH - (v / max) * plotH;
    g += `<line class="sc-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/>`;
    g += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end">${shortNum(v)}</text>`;
  }
  data.forEach((d, i) => {
    const h = Math.max((Math.max(d.value, 0) / max) * plotH, 1);
    const x = padL + slot * i + (slot - barW) / 2;
    const y = padT + plotH - h;
    const cx = x + barW / 2;
    const color = SMART_COLORS[i % SMART_COLORS.length];
    const label = d.label.length > 16 ? d.label.slice(0, 15) + "…" : d.label;
    g += `<rect class="sc-bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${color}"><title>${esc(d.label)}: ${fmtNum(d.value)}</title></rect>`;
    g += `<text class="sc-val" x="${cx}" y="${y - 5}" text-anchor="middle">${shortNum(d.value)}</text>`;
    g += rotate
      ? `<text x="${cx}" y="${padT + plotH + 12}" text-anchor="end" transform="rotate(-40 ${cx} ${padT + plotH + 12})">${esc(label)}</text>`
      : `<text x="${cx}" y="${padT + plotH + 16}" text-anchor="middle">${esc(label)}</text>`;
  });
  g += `<line class="sc-axis" x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}"/>`;
  return `<div class="sc-scroll"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of ${esc(yName)}">${g}</svg></div>`;
}

// ---------------------------------------------------------------------------
// Pie chart (donut)
// ---------------------------------------------------------------------------
function drawPie(data) {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0);
  if (total <= 0) return null;
  const R = 110, r = 58, C = 120;
  const pt = (rad, a) => [C + rad * Math.cos(a - Math.PI / 2), C + rad * Math.sin(a - Math.PI / 2)];
  let angle = 0, paths = "", legend = "";

  data.forEach((d, i) => {
    const color = SMART_COLORS[i % SMART_COLORS.length];
    const frac = Math.max(d.value, 0) / total;
    const pct = (frac * 100).toFixed(frac < 0.1 ? 1 : 0);
    if (frac >= 0.9999) {
      paths += `<circle class="sc-slice" cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="${color}" stroke-width="${R - r}"><title>${esc(d.label)}: ${fmtNum(d.value)}</title></circle>`;
    } else if (frac > 0) {
      const a0 = angle, a1 = angle + frac * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
      paths += `<path class="sc-slice" d="M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${big} 0 ${x3} ${y3} Z" fill="${color}" stroke="var(--surface, #fff)" stroke-width="2"><title>${esc(d.label)}: ${fmtNum(d.value)} (${pct}%)</title></path>`;
      angle = a1;
    }
    legend += `<li><span class="sc-sw" style="background:${color}"></span><span>${esc(d.label)}</span><strong>${fmtNum(d.value)}</strong><span class="sc-pct">(${pct}%)</span></li>`;
  });

  const center = `<text x="${C}" y="${C - 2}" text-anchor="middle" style="font-size:20px;font-weight:700">${shortNum(total)}</text>` +
                 `<text x="${C}" y="${C + 16}" text-anchor="middle" style="opacity:.6">total</text>`;
  return `<div class="sc-pie"><svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="Pie chart">${paths}${center}</svg><ul class="sc-legend">${legend}</ul></div>`;
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------
function drawLine(data, yName) {
  const n = data.length;
  const padL = 48, padR = 20, padT = 22, padB = n > 8 ? 64 : 36;
  const W = Math.max(520, padL + padR + n * 56), H = 280;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vals = data.map((d) => d.value);
  const minV = Math.min(0, ...vals);
  const max = niceMax(Math.max(...vals, 0) - minV) + minV;
  const xAt = (i) => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yAt = (v) => padT + plotH - ((v - minV) / (max - minV || 1)) * plotH;

  let g = `<defs><linearGradient id="scLineFill" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${LINE_COLOR}" stop-opacity=".28"/>
      <stop offset="1" stop-color="${LINE_COLOR}" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; i <= 4; i++) {
    const v = minV + ((max - minV) / 4) * i, yy = yAt(v);
    g += `<line class="sc-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/>`;
    g += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end">${shortNum(v)}</text>`;
  }
  const pts = data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(" ");
  const base = yAt(Math.max(minV, 0));
  g += `<polygon points="${xAt(0)},${base} ${pts} ${xAt(n - 1)},${base}" fill="url(#scLineFill)"/>`;
  g += `<polyline points="${pts}" fill="none" stroke="${LINE_COLOR}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;

  const every = Math.ceil(n / 14);
  data.forEach((d, i) => {
    const x = xAt(i), y = yAt(d.value);
    g += `<circle class="sc-dot" cx="${x}" cy="${y}" r="4.5" fill="var(--surface, #fff)" stroke="${SMART_COLORS[1]}" stroke-width="2.5"><title>${esc(d.label)}: ${fmtNum(d.value)}</title></circle>`;
    if (n <= 14) g += `<text class="sc-val" x="${x}" y="${y - 10}" text-anchor="middle">${shortNum(d.value)}</text>`;
    if (i % every === 0) {
      g += n > 8
        ? `<text x="${x}" y="${padT + plotH + 14}" text-anchor="end" transform="rotate(-40 ${x} ${padT + plotH + 14})">${esc(d.label)}</text>`
        : `<text x="${x}" y="${padT + plotH + 18}" text-anchor="middle">${esc(d.label)}</text>`;
    }
  });
  g += `<line class="sc-axis" x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}"/>`;
  return `<div class="sc-scroll"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart of ${esc(yName)}">${g}</svg></div>`;
}

// ---------------------------------------------------------------------------
// Main entry
// type: "bar" | "pie" | "line"; spec: { x, y, reason } from the backend (optional)
// ---------------------------------------------------------------------------
export function renderSmartChart(container, result, type, spec) {
  injectStyles();
  container.innerHTML = "";
  const { columns = [], rows = [] } = result || {};
  const { x, y } = resolveColumns({ columns, rows }, spec);

  if (!y) {
    container.append(el("p", "empty", "No numeric column to chart. Switch back to the table view."));
    return;
  }

  let data = rows
    .filter((r) => isNum(r[y]))
    .map((r, i) => ({ label: x ? fmtLabel(r[x]) : `Row ${i + 1}`, value: Number(r[y]), raw: x ? r[x] : i }));

  if (type === "line") {
    data.sort((a, b) => (a.raw > b.raw ? 1 : a.raw < b.raw ? -1 : 0));
    data = data.slice(0, 60);
  } else if (type === "pie") {
    data = data.slice(0, 12); // matches the backend limit for requested pie charts
  } else {
    data = data.slice(0, 30);
  }

  const pretty = (c) => String(c).replace(/_/g, " ");
  const wrap = el("div", "smart-chart");
  const caption = (x ? `${pretty(y)} by ${pretty(x)}` : pretty(y)) + (spec?.reason ? ` — ${spec.reason}` : "");
  wrap.append(el("p", "chart-caption", caption));

  const svg = type === "pie" ? drawPie(data) : type === "line" ? drawLine(data, y) : drawBar(data, y);
  if (!svg) {
    container.append(el("p", "empty", "No positive values to chart."));
    return;
  }
  const holder = document.createElement("div");
  holder.innerHTML = svg;
  wrap.append(...holder.childNodes);
  container.append(wrap);
}

// Marks suggested chart buttons with a dot and dims the rest.
export function markSuggestedViews(buttons, charts) {
  injectStyles();
  const toView = (t) => (t === "bar" ? "chart" : t);
  const suggested = new Set((charts || []).map((c) => toView(c.type)));
  const hasSuggestions = suggested.size > 0;
  buttons.forEach((b) => {
    const v = b.dataset.view;
    if (v === "table") return;
    const on = suggested.has(v);
    b.classList.toggle("sc-suggested", on);
    b.classList.toggle("sc-dim", hasSuggestions ? !on : false);
    b.title = on ? "Suggested chart" : "";
  });
}