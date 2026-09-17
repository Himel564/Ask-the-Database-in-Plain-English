import { el } from "./utils.js";

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
