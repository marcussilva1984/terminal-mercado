"use client";

const COLORS = ["#d4af37", "#18c964", "#f5455c", "#5b9bd5", "#f5a524", "#9b59b6", "#1abc9c", "#e67e22"];

export interface PieSlice {
  label: string;
  value: number;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <p className="text-sm text-text-muted">Sem posições para exibir.</p>;
  }

  const { paths } = slices.reduce<{ paths: { path: string; color: string }[]; angle: number }>(
    (acc, s, i) => {
      const fraction = s.value / total;
      const startAngle = acc.angle;
      const endAngle = startAngle + fraction * Math.PI * 2;
      acc.paths.push({ path: describeArc(50, 50, 48, startAngle, endAngle), color: COLORS[i % COLORS.length] });
      acc.angle = endAngle;
      return acc;
    },
    { paths: [], angle: -Math.PI / 2 }
  );

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.path} fill={p.color} />
        ))}
      </svg>
      <ul className="flex flex-col gap-1 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-text">{s.label}</span>
            <span className="text-text-muted">{((s.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
