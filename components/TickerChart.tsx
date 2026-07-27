"use client";

import { useState } from "react";

export function TickerChart({ points, currency }: { points: { date: string; close: number }[]; currency: string | null }) {
  const [hover, setHover] = useState<{ x: number; date: string; close: number } | null>(null);

  if (points.length < 2) {
    return <p className="text-sm text-text-muted">Sem histórico suficiente pra gráfico.</p>;
  }

  const width = 800;
  const height = 220;
  const padding = 8;

  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: padding + i * stepX,
    y: padding + (height - padding * 2) * (1 - (p.close - min) / range),
    date: p.date,
    close: p.close,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padding} L ${coords[0].x.toFixed(1)} ${height - padding} Z`;

  const up = closes[closes.length - 1] >= closes[0];
  const strokeClass = up ? "stroke-up" : "stroke-down";
  const fillClass = up ? "fill-up/10" : "fill-down/10";

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = coords[0];
    let closestDiff = Infinity;
    for (const c of coords) {
      const diff = Math.abs(c.x - relX);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = c;
      }
    }
    setHover({ x: closest.x, date: closest.date, close: closest.close });
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={areaPath} className={fillClass} stroke="none" />
        <path d={linePath} className={strokeClass} fill="none" strokeWidth={1.5} />
        {hover && <line x1={hover.x} x2={hover.x} y1={padding} y2={height - padding} className="stroke-border" strokeWidth={1} />}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute top-0 rounded border border-border bg-panel px-2 py-1 text-xs text-text" style={{ left: `${(hover.x / width) * 100}%` }}>
          <div className="text-text-muted">{new Date(hover.date).toLocaleDateString("pt-BR")}</div>
          <div className="font-medium">
            {currency === "BRL" ? "R$" : "US$"} {hover.close.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
