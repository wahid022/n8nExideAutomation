export default function DonutChart({ segments = [], size = 160, thickness = 26, centerLabel }) {
  const r = size / 2 - thickness / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (!total) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={thickness} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#94A3B8">No data</text>
      </svg>
    );
  }

  let cumPct = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * C;
        const dashOffset = C * (1 - cumPct);
        cumPct += pct;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness - 3}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={dashOffset}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
          >
            {seg.label && <title>{seg.label}: {seg.value}{seg.pct != null ? ` (${seg.pct}%)` : ""}</title>}
          </circle>
        );
      })}
      {centerLabel ? (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0F172A">{centerLabel.top}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8.5" fill="#64748B">{centerLabel.bottom}</text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 7} textAnchor="middle" fontSize="24" fontWeight="800" fill="#0F172A">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#64748B" letterSpacing="0.5">{segments[0]?.unit || ""}</text>
        </>
      )}
    </svg>
  );
}
