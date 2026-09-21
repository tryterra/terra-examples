// A bare inline SVG sparkline over the last N points (no axes/labels).
// Stroke follows currentColor — set the color with a text-* class.
// Fluid: fills its container's width (cap it with max-w-*) so stat cards can
// shrink in a tight grid without their sparkline forcing an overflow.
export function Sparkline({
  points,
  width = 120,
  height = 36,
  className,
}: {
  points: number[];
  /** Logical drawing width (viewBox units) — rendered width is the container's. */
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) {
    return <svg width="100%" height={height} aria-hidden="true" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * stepX;
      // Invert y so larger values sit higher; pad 2px top/bottom.
      const y = height - 2 - ((p - min) / span) * (height - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className ?? "text-primary"}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
