// Simple bar chart: first text column as labels, first numeric column as values.
export default function ResultsChart({ columns, rows }) {
  const isNum = (v) => v !== null && v !== "" && !isNaN(Number(v)) && typeof v !== "boolean";
  const valueCol = columns.find((c) => rows.every((r) => isNum(r[c]))  && !/(^id$|_id$)/i.test(c))
    ?? columns.find((c) => rows.every((r) => isNum(r[c])));
  const labelCol = columns.find((c) => c !== valueCol && !rows.every((r) => isNum(r[c]))) ?? null;

  if (!valueCol) {
    return <p className="empty">No numeric column to chart. Switch back to the table view.</p>;
  }

  const data = rows.slice(0, 20).map((r, i) => ({
    label: labelCol ? String(r[labelCol]) : `Row ${i + 1}`,
    value: Number(r[valueCol]),
  }));
  const max = Math.max(...data.map((d) => d.value), 0) || 1;

  return (
    <div className="chart">
      <p className="chart-caption">{valueCol}{labelCol ? ` by ${labelCol}` : ""}</p>
      {data.map((d, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label" title={d.label}>{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max((d.value / max) * 100, 1)}%` }} />
          </div>
          <span className="bar-value">{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
