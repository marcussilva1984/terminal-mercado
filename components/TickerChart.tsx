"use client";

import { useEffect, useState, useCallback } from "react";

interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVALS = [
  { value: "1d", label: "Diário" },
  { value: "1wk", label: "Semanal" },
  { value: "1mo", label: "Mensal" },
] as const;

function computeSMA(closes: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= window) sum -= closes[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

export function TickerChart({ symbol, currency }: { symbol: string; currency: string | null }) {
  const [interval, setInterval_] = useState<(typeof INTERVALS)[number]["value"]>("1d");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; candle: Candle } | null>(null);

  const load = useCallback(async () => {
    setCandles(null);
    setError(null);
    try {
      const res = await fetch(`/api/ticker-chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
      const json = await res.json();
      if (!json.available) throw new Error(json.error ?? "Falha ao carregar gráfico");
      setCandles(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar gráfico");
    }
  }, [symbol, interval]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/interval change, no alternative
    load();
  }, [load]);

  if (error) return <p className="text-sm text-down">Fonte indisponível: {error}</p>;
  if (!candles) return <p className="text-sm text-text-muted">Carregando gráfico...</p>;
  if (candles.length < 2) return <p className="text-sm text-text-muted">Sem histórico suficiente pra gráfico.</p>;

  // Mostra só os últimos N candles pra não poluir, mas usa a série inteira pra SMA200.
  const visibleCount = interval === "1d" ? 180 : interval === "1wk" ? 156 : 120;
  const closes = candles.map((c) => c.close);
  const sma200Full = computeSMA(closes, 200);

  const visible = candles.slice(-visibleCount);
  const sma200 = sma200Full.slice(-visibleCount);

  const width = 900;
  const chartHeight = 260;
  const volumeHeight = 60;
  const gap = 10;
  const totalHeight = chartHeight + gap + volumeHeight;
  const padding = 6;

  const highs = visible.map((c) => c.high);
  const lows = visible.map((c) => c.low);
  const validSma = sma200.filter((v): v is number => v !== null);
  const min = Math.min(...lows, ...(validSma.length ? validSma : [Infinity]));
  const max = Math.max(...highs, ...(validSma.length ? validSma : [-Infinity]));
  const range = max - min || 1;
  const maxVolume = Math.max(...visible.map((c) => c.volume), 1);

  const stepX = (width - padding * 2) / visible.length;
  const candleWidth = Math.max(1, stepX * 0.6);

  const yFor = (price: number) => padding + (chartHeight - padding * 2) * (1 - (price - min) / range);
  const xFor = (i: number) => padding + i * stepX + stepX / 2;

  const smaPath = sma200
    .map((v, i) => (v !== null ? `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}` : null))
    .filter((p): p is string => p !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p}`)
    .join(" ");

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.max(0, Math.min(visible.length - 1, Math.round((relX - padding - stepX / 2) / stepX)));
    setHover({ x: xFor(i), candle: visible[i] });
  }

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {INTERVALS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setInterval_(opt.value)}
            className={`rounded border px-2 py-1 text-xs transition-colors ${
              interval === opt.value ? "border-gold bg-gold/10 text-gold-bright" : "border-border text-text-muted hover:text-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${totalHeight}`}
          className="w-full"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* candles */}
          {visible.map((c, i) => {
            const x = xFor(i);
            const up = c.close >= c.open;
            const color = up ? "stroke-up fill-up" : "stroke-down fill-down";
            const bodyTop = yFor(Math.max(c.open, c.close));
            const bodyBottom = yFor(Math.min(c.open, c.close));
            return (
              <g key={c.date} className={color}>
                <line x1={x} x2={x} y1={yFor(c.high)} y2={yFor(c.low)} strokeWidth={1} />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={Math.max(1, bodyBottom - bodyTop)}
                  stroke="none"
                />
              </g>
            );
          })}
          {/* SMA200 */}
          {smaPath && <path d={smaPath} fill="none" className="stroke-gold-bright" strokeWidth={1.2} opacity={0.85} />}
          {/* volume */}
          {visible.map((c, i) => {
            const x = xFor(i);
            const up = c.close >= c.open;
            const h = (c.volume / maxVolume) * (volumeHeight - 4);
            return (
              <rect
                key={`vol-${c.date}`}
                x={x - candleWidth / 2}
                y={chartHeight + gap + (volumeHeight - h)}
                width={candleWidth}
                height={h}
                className={up ? "fill-up/50" : "fill-down/50"}
              />
            );
          })}
          {hover && (
            <line x1={hover.x} x2={hover.x} y1={padding} y2={totalHeight - padding} className="stroke-border" strokeWidth={1} />
          )}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-border bg-panel px-2 py-1 text-xs text-text"
            style={{ left: `${Math.min(85, (hover.x / width) * 100)}%` }}
          >
            <div className="text-text-muted">{new Date(hover.candle.date).toLocaleDateString("pt-BR")}</div>
            <div>
              A: {hover.candle.open.toFixed(2)} F: {hover.candle.close.toFixed(2)}
            </div>
            <div>
              Máx: {hover.candle.high.toFixed(2)} Mín: {hover.candle.low.toFixed(2)}
            </div>
            <div className="text-text-muted">Vol: {hover.candle.volume.toLocaleString("pt-BR")}</div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {currency === "BRL" ? "R$" : "US$"} · Linha dourada = média móvel de 200 períodos.
      </p>
    </div>
  );
}
