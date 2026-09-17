import { el, html } from "./utils.js";

// Simple bar chart: first text column as labels, first numeric column as values.
export function renderChart(container, { columns, rows }) {
  container.innerHTML = "";
  const isNum = (v) => v !== null && v !== "" && typeof v !== "boolean" && !isNaN(Number(v));

  const valueCol =
    columns.find((c) => rows.every((r) => isNum(r[c])) && !/(^id$|_id$)/i.test(c)) ??
    columns.find((c) => rows.every((r) => isNum(r[c])));
  const labelCol = columns.find((c) => c !== valueCol && !rows.every((r) => isNum(r[c]))) ?? null;

  if (!valueCol) {
    container.append(el("p", "empty", "No numeric column to chart. Switch back to the table view."));
    return;
  }

  const data = rows.slice(0, 20).map((r, i) => ({
    label: labelCol ? String(r[labelCol]) : `Row ${i + 1}`,
    value: Number(r[valueCol]),
  }));
  const max = Math.max(...data.map((d) => d.value), 0) || 1;

  const chart = el("div", "chart");
  chart.append(el("p", "chart-caption", labelCol ? `${valueCol} by ${labelCol}` : valueCol));

  data.forEach((d) => {
    const row = el("div", "bar-row");
    const label = el("span", "bar-label", d.label);
    label.title = d.label;
    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill");
    fill.style.width = `${Math.max((d.value / max) * 100, 1)}%`;
    track.append(fill);
    row.append(label, track, el("span", "bar-value", d.value.toLocaleString()));
    chart.append(row);
  });

  container.append(chart);
}

// Pie chart: same column auto-detection as renderChart, drawn as SVG wedges + legend.
const PIE_COLORS = [
  "#3f7556", // forest green (brand anchor)
  "#d98e3f", // warm amber
  "#4a7fb5", // muted blue
  "#c4574d", // brick red
  "#8a6bb0", // soft violet
  "#5c9877", // sage green
  "#c9a227", // gold
];
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function renderPieChart(container, { columns, rows }) {
  container.innerHTML = "";
  const isNum = (v) => v !== null && v !== "" && typeof v !== "boolean" && !isNaN(Number(v));

  const valueCol =
    columns.find((c) => rows.every((r) => isNum(r[c])) && !/(^id$|_id$)/i.test(c)) ??
    columns.find((c) => rows.every((r) => isNum(r[c])));
  const labelCol = columns.find((c) => c !== valueCol && !rows.every((r) => isNum(r[c]))) ?? null;

  if (!valueCol) {
    container.append(el("p", "empty", "No numeric column to chart. Switch back to the table view."));
    return;
  }

  const data = rows.slice(0, 12).map((r, i) => ({
    label: labelCol ? String(r[labelCol]) : `Row ${i + 1}`,
    value: Number(r[valueCol]),
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    container.append(el("p", "empty", "No positive values to chart."));
    return;
  }

  const size = 220;
  const radius = size / 2;
  let angleCursor = 0;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 360;
    const path = describeSlice(radius, radius, radius, angleCursor, angleCursor + angle);
    const slice = {
      ...d,
      path,
      color: PIE_COLORS[i % PIE_COLORS.length],
      percent: Math.round((d.value / total) * 100),
    };
    angleCursor += angle;
    return slice;
  });

  const wrap = html(`
    <div class="pie-chart">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${slices.map((s) => `<path d="${s.path}" fill="${s.color}" stroke="var(--surface)" stroke-width="1"></path>`).join("")}
      </svg>
      <ul class="pie-legend"></ul>
    </div>
  `);

  const legend = wrap.querySelector(".pie-legend");
  slices.forEach((s) => {
    const item = html(`
      <li>
        <span class="pie-swatch" style="background:${s.color}"></span>
        <span class="pie-label"></span>
        <strong></strong>
        <span class="pie-pct"></span>
      </li>
    `);
    item.querySelector(".pie-label").textContent = s.label;
    item.querySelector("strong").textContent = s.value.toLocaleString();
    item.querySelector(".pie-pct").textContent = `(${s.percent}%)`;
    legend.append(item);
  });

  container.append(wrap);
}