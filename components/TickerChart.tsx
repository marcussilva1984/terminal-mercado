"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { computeSupportResistance, computeTrendLines, type Candle, type SRLevel, type TrendLine } from "@/lib/technicalAnalysis";

const INTERVALS = [
  { value: "1d", label: "Diário" },
  { value: "1wk", label: "Semanal" },
  { value: "1mo", label: "Mensal" },
] as const;

const WIDTH = 900;
const CHART_HEIGHT = 260;
const VOLUME_HEIGHT = 60;
const GAP = 10;
const TOTAL_HEIGHT = CHART_HEIGHT + GAP + VOLUME_HEIGHT;
const PADDING = 6;
const Y_AXIS_WIDTH = 52; // espaço reservado à direita pros rótulos de preço
const SUPPORT_COLOR = "#3b82f6"; // azul
const RESISTANCE_COLOR = "#f5a524"; // laranja (mesmo tom do --color-amber)

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

interface ResolvedTrendLine extends TrendLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Parte pesada do gráfico (candles, volume, médias, S/R) isolada num
// componente memoizado — o crosshair/tooltip do hover fica FORA daqui, num
// overlay separado, pra mover o mouse não forçar recálculo/re-render de
// centenas de elementos SVG a cada pixel (era a causa do travamento).
const StaticChart = memo(function StaticChart({
  visible,
  sma200,
  visibleSR,
  visibleTrendLines,
  min,
  max,
  maxVolume,
}: {
  visible: Candle[];
  sma200: (number | null)[];
  visibleSR: SRLevel[];
  visibleTrendLines: ResolvedTrendLine[];
  min: number;
  max: number;
  maxVolume: number;
}) {
  const range = max - min || 1;
  const plotWidth = WIDTH - Y_AXIS_WIDTH;
  const stepX = (plotWidth - PADDING * 2) / visible.length;
  const candleWidth = Math.max(1, stepX * 0.6);

  const yFor = (price: number) => PADDING + (CHART_HEIGHT - PADDING * 2) * (1 - (price - min) / range);
  const xFor = (i: number) => PADDING + i * stepX + stepX / 2;

  const smaPath = sma200
    .map((v, i) => (v !== null ? `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}` : null))
    .filter((p): p is string => p !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p}`)
    .join(" ");

  // Eixo Y: 5 níveis de preço igualmente espaçados.
  const yTicks = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);

  // Eixo X: ~6 datas igualmente espaçadas.
  const xTickCount = Math.min(6, visible.length);
  const xTickIndices = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i * (visible.length - 1)) / (xTickCount - 1 || 1))
  );

  return (
    <svg viewBox={`0 0 ${WIDTH} ${TOTAL_HEIGHT}`} className="w-full">
      {/* grade horizontal + rótulos de preço */}
      {yTicks.map((price, i) => (
        <g key={`ytick-${i}`}>
          <line x1={PADDING} x2={plotWidth} y1={yFor(price)} y2={yFor(price)} className="stroke-border" strokeWidth={0.5} opacity={0.4} />
          <text x={plotWidth + 4} y={yFor(price) + 3} className="fill-text-muted text-[9px]">
            {price.toFixed(2)}
          </text>
        </g>
      ))}
      {/* suporte/resistência — suporte azul, resistência laranja */}
      {visibleSR.map((l) => (
        <g key={`sr-${l.price}`}>
          <line
            x1={PADDING}
            x2={plotWidth}
            y1={yFor(l.price)}
            y2={yFor(l.price)}
            stroke={l.type === "support" ? SUPPORT_COLOR : RESISTANCE_COLOR}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.55}
          />
        </g>
      ))}
      {/* canal de tendência — suporte azul, resistência laranja */}
      {visibleTrendLines.map((t) => (
        <line
          key={t.type}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.type === "support" ? SUPPORT_COLOR : RESISTANCE_COLOR}
          strokeWidth={1.3}
          opacity={0.8}
        />
      ))}
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
            <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={Math.max(1, bodyBottom - bodyTop)} stroke="none" />
          </g>
        );
      })}
      {/* SMA200 */}
      {smaPath && <path d={smaPath} fill="none" className="stroke-gold-bright" strokeWidth={1.2} opacity={0.85} />}
      {/* volume */}
      {visible.map((c, i) => {
        const x = xFor(i);
        const up = c.close >= c.open;
        const h = (c.volume / maxVolume) * (VOLUME_HEIGHT - 4);
        return (
          <rect
            key={`vol-${c.date}`}
            x={x - candleWidth / 2}
            y={CHART_HEIGHT + GAP + (VOLUME_HEIGHT - h)}
            width={candleWidth}
            height={h}
            className={up ? "fill-up/50" : "fill-down/50"}
          />
        );
      })}
      {/* eixo X: datas */}
      {xTickIndices.map((i) => (
        <text key={`xtick-${i}`} x={xFor(i)} y={TOTAL_HEIGHT - 2} textAnchor="middle" className="fill-text-muted text-[9px]">
          {new Date(visible[i].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </text>
      ))}
    </svg>
  );
});

export function TickerChart({ symbol, currency }: { symbol: string; currency: string | null }) {
  const [interval, setInterval_] = useState<(typeof INTERVALS)[number]["value"]>("1d");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTA, setShowTA] = useState(true);

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
    setHoverIndex(null);
  }, [load]);

  const srLevels = useMemo(() => (candles ? computeSupportResistance(candles) : []), [candles]);
  const trendLines = useMemo(() => (candles ? computeTrendLines(candles) : []), [candles]);

  const visibleCount = interval === "1d" ? 180 : interval === "1wk" ? 156 : 120;

  const visible = useMemo(() => (candles ? candles.slice(-visibleCount) : []), [candles, visibleCount]);
  const sma200 = useMemo(() => {
    if (!candles) return [];
    const closes = candles.map((c) => c.close);
    return computeSMA(closes, 200).slice(-visibleCount);
  }, [candles, visibleCount]);
  const offset = candles ? candles.length - visible.length : 0;

  const visibleSR = useMemo(() => {
    if (!showTA || visible.length === 0) return [];
    const lo = Math.min(...visible.map((c) => c.low)) * 0.85;
    const hi = Math.max(...visible.map((c) => c.high)) * 1.15;
    return srLevels.filter((l) => l.price >= lo && l.price <= hi);
  }, [showTA, srLevels, visible]);

  const plotWidth = WIDTH - Y_AXIS_WIDTH;
  const stepX = visible.length > 0 ? (plotWidth - PADDING * 2) / visible.length : 0;

  const { min, max, maxVolume } = useMemo(() => {
    if (visible.length === 0) return { min: 0, max: 1, maxVolume: 1 };
    const highs = visible.map((c) => c.high);
    const lows = visible.map((c) => c.low);
    const validSma = sma200.filter((v): v is number => v !== null);
    const srPrices = visibleSR.map((l) => l.price);
    return {
      min: Math.min(...lows, ...(validSma.length ? validSma : [Infinity]), ...(srPrices.length ? srPrices : [Infinity])),
      max: Math.max(...highs, ...(validSma.length ? validSma : [-Infinity]), ...(srPrices.length ? srPrices : [-Infinity])),
      maxVolume: Math.max(...visible.map((c) => c.volume), 1),
    };
  }, [visible, sma200, visibleSR]);

  const visibleTrendLines: ResolvedTrendLine[] = useMemo(() => {
    if (!showTA || visible.length === 0) return [];
    const range = max - min || 1;
    const yFor = (price: number) => PADDING + (CHART_HEIGHT - PADDING * 2) * (1 - (price - min) / range);
    const xFor = (i: number) => PADDING + i * stepX + stepX / 2;
    return trendLines
      .map((t) => {
        const startVis = Math.max(0, t.startIndex - offset);
        const endVis = visible.length - 1;
        if (endVis < 0 || startVis > endVis) return null;
        const priceAt = (fullIndex: number) => t.slope * fullIndex + t.intercept;
        return { ...t, x1: xFor(startVis), y1: yFor(priceAt(startVis + offset)), x2: xFor(endVis), y2: yFor(priceAt(endVis + offset)) };
      })
      .filter((t): t is ResolvedTrendLine => t !== null);
  }, [showTA, trendLines, visible, offset, min, max, stepX]);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (visible.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.max(0, Math.min(visible.length - 1, Math.round((relX - PADDING - stepX / 2) / stepX)));
    setHoverIndex(i);
  }

  if (error) return <p className="text-sm text-down">Fonte indisponível: {error}</p>;
  if (!candles) return <p className="text-sm text-text-muted">Carregando gráfico...</p>;
  if (candles.length < 2) return <p className="text-sm text-text-muted">Sem histórico suficiente pra gráfico.</p>;

  const hoverCandle = hoverIndex !== null ? visible[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? PADDING + hoverIndex * stepX + stepX / 2 : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
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
        <button
          onClick={() => setShowTA((v) => !v)}
          className={`rounded border px-2 py-1 text-xs transition-colors ${
            showTA ? "border-gold bg-gold/10 text-gold-bright" : "border-border text-text-muted hover:text-text"
          }`}
        >
          Suporte/Resistência
        </button>
      </div>

      <div className="relative" onMouseMove={handleMove} onMouseLeave={() => setHoverIndex(null)}>
        <StaticChart visible={visible} sma200={sma200} visibleSR={visibleSR} visibleTrendLines={visibleTrendLines} min={min} max={max} maxVolume={maxVolume} />
        {hoverCandle && (
          <svg viewBox={`0 0 ${WIDTH} ${TOTAL_HEIGHT}`} className="pointer-events-none absolute inset-0 w-full">
            <line x1={hoverX} x2={hoverX} y1={PADDING} y2={TOTAL_HEIGHT - PADDING} className="stroke-border" strokeWidth={1} />
          </svg>
        )}
        {hoverCandle && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-border bg-panel px-2 py-1 text-xs text-text"
            style={{ left: `${Math.min(78, (hoverX / WIDTH) * 100)}%` }}
          >
            <div className="text-text-muted">{new Date(hoverCandle.date).toLocaleDateString("pt-BR")}</div>
            <div>
              A: {hoverCandle.open.toFixed(2)} F: {hoverCandle.close.toFixed(2)}
            </div>
            <div>
              Máx: {hoverCandle.high.toFixed(2)} Mín: {hoverCandle.low.toFixed(2)}
            </div>
            <div className="text-text-muted">Vol: {hoverCandle.volume.toLocaleString("pt-BR")}</div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {currency === "BRL" ? "R$" : "US$"} · Linha dourada = média móvel de 200 períodos.
      </p>
    </div>
  );
}
