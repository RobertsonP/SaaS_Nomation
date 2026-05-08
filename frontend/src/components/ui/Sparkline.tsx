interface SparklineProps {
  data: number[];
  /** Stroke color — accepts any CSS color or var(--…). Defaults to moss. */
  color?: string;
  /** Optional fixed height in px. Defaults to 34 to match the prototype. */
  height?: number;
}

/**
 * SVG sparkline matching the prototype dashboard.jsx Sparkline.
 * Renders a thin line plus a faint fill below to suggest a trend.
 */
export function Sparkline({ data, color = 'var(--moss)', height = 34 }: SparklineProps) {
  if (!data || data.length === 0) {
    return <svg width="100%" height={height} aria-hidden="true" />;
  }

  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${i * 4},${height - (v / max) * (height - 4)}`)
    .join(' ');
  const fillPath = `${points} L${(data.length - 1) * 4},${height} L0,${height} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${data.length * 4} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={fillPath} fill={color} opacity="0.08" />
      <path d={points} stroke={color} strokeWidth="1.4" fill="none" />
    </svg>
  );
}
