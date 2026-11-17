export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
  // true = histograma crescendo (momentum positivo), false = caindo
  bullish: boolean;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

// MACD padrão: 12/26/9. Retorna null se não há closes suficientes.
export function computeMacd(closes: number[], fast = 12, slow = 26, signal = 9): MacdResult | null {
  if (closes.length < slow + signal) return null;

  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  // Alinha: a EMA lenta começa depois
  const offset = emaSlow.length - emaFast.length;
  const macdLine = emaSlow.map((s, i) => emaFast[i + offset] - s);

  const signalLine = ema(macdLine, signal);
  const sigOffset = macdLine.length - signalLine.length;

  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const lastHist = lastMacd - lastSignal;
  const prevHist = macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2 + sigOffset - sigOffset];

  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastHist,
    bullish: lastHist > (prevHist ?? lastHist),
  };
}

// Retorna um sinal legível: "alta", "baixa" ou null
export function macdSignal(result: MacdResult | null): "alta" | "baixa" | null {
  if (!result) return null;
  if (result.macd > result.signal && result.bullish) return "alta";
  if (result.macd < result.signal && !result.bullish) return "baixa";
  return null;
}
