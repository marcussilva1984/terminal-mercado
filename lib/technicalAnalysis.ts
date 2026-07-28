// Suporte/resistência e linha de tendência calculados a partir do próprio
// OHLC que já coletamos — sem API externa (não existe "API de análise
// técnica" gratuita de verdade; isso é cálculo, não dado). Deliberadamente
// NÃO inclui reconhecimento de padrões gráficos (ombro-cabeça-ombro, cunha
// etc.) — isso é subjetivo até pra analista humano e um algoritmo ingênuo
// erra com frequência, o que violaria a regra de não mostrar dado errado.

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SRLevel {
  price: number;
  touches: number;
  type: "support" | "resistance";
}

export interface TrendLine {
  type: "support" | "resistance";
  // y = slope * index + intercept, no espaço de índice do candle (não de tempo)
  slope: number;
  intercept: number;
  startIndex: number;
  endIndex: number;
}

interface Pivot {
  index: number;
  price: number;
  kind: "high" | "low";
}

// Um candle é pivô se for o maior/menor máximo/mínimo numa janela de `lookback`
// candles pra cada lado — método padrão de detecção de topo/fundo local.
function findPivots(candles: Candle[], lookback = 4): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const windowHighs = candles.slice(i - lookback, i + lookback + 1).map((c) => c.high);
    const windowLows = candles.slice(i - lookback, i + lookback + 1).map((c) => c.low);
    if (candles[i].high === Math.max(...windowHighs)) {
      pivots.push({ index: i, price: candles[i].high, kind: "high" });
    }
    if (candles[i].low === Math.min(...windowLows)) {
      pivots.push({ index: i, price: candles[i].low, kind: "low" });
    }
  }
  return pivots;
}

// Agrupa pivôs com preços próximos (dentro de `tolerancePct`) em níveis —
// mais toques no mesmo nível = suporte/resistência mais forte.
function clusterLevels(pivots: Pivot[], currentPrice: number, tolerancePct = 0.015): SRLevel[] {
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const clusters: { prices: number[]; count: number }[] = [];

  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const avg = last.prices.reduce((a, b) => a + b, 0) / last.prices.length;
      if (Math.abs(p.price - avg) / avg <= tolerancePct) {
        last.prices.push(p.price);
        last.count++;
        continue;
      }
    }
    clusters.push({ prices: [p.price], count: 1 });
  }

  return clusters
    .filter((c) => c.count >= 2) // exige pelo menos 2 toques pra contar como nível relevante
    .map((c) => {
      const avg = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
      return { price: avg, touches: c.count, type: avg >= currentPrice ? "resistance" : "support" } as SRLevel;
    });
}

export function computeSupportResistance(candles: Candle[], maxLevels = 4): SRLevel[] {
  if (candles.length < 20) return [];
  const pivots = findPivots(candles);
  const currentPrice = candles[candles.length - 1].close;
  const levels = clusterLevels(pivots, currentPrice);

  const resistance = levels
    .filter((l) => l.type === "resistance")
    .sort((a, b) => b.touches - a.touches || a.price - currentPrice - (b.price - currentPrice))
    .slice(0, maxLevels);
  const support = levels
    .filter((l) => l.type === "support")
    .sort((a, b) => b.touches - a.touches || currentPrice - a.price - (currentPrice - b.price))
    .slice(0, maxLevels);

  return [...support, ...resistance];
}

// Regressão linear simples (mínimos quadrados) sobre os pivôs de baixa
// (linha de suporte) e de alta (linha de resistência) da janela visível.
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function computeTrendLines(candles: Candle[]): TrendLine[] {
  if (candles.length < 20) return [];
  const pivots = findPivots(candles);
  const lows = pivots.filter((p) => p.kind === "low");
  const highs = pivots.filter((p) => p.kind === "high");

  const lines: TrendLine[] = [];
  const lowFit = linearRegression(lows.map((p) => ({ x: p.index, y: p.price })));
  if (lowFit && lows.length >= 2) {
    lines.push({
      type: "support",
      slope: lowFit.slope,
      intercept: lowFit.intercept,
      startIndex: lows[0].index,
      endIndex: candles.length - 1,
    });
  }
  const highFit = linearRegression(highs.map((p) => ({ x: p.index, y: p.price })));
  if (highFit && highs.length >= 2) {
    lines.push({
      type: "resistance",
      slope: highFit.slope,
      intercept: highFit.intercept,
      startIndex: highs[0].index,
      endIndex: candles.length - 1,
    });
  }
  return lines;
}
