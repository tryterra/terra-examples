/** Tiny inline SVG line for sparse time series (e.g. score history). */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  warn = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  warn?: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
  const color = warn ? "var(--color-warning)" : "var(--color-emphasis)";
  const [lastX, lastY] = points.split(" ").at(-1)!.split(",");
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill={color} stroke="white" strokeWidth={1.5} />
    </svg>
  );
}
