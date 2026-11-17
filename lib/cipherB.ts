// Cipher B — WaveTrend + RSI + Stoch RSI + divergências
// Aproximação com close price (HLC3 não disponível no banco).

export interface CipherBResult {
  wt1: number;
  wt2: number;
  rsi: number;
  stochRsi: number;
  // Divergências detectadas no último candle
  bullishDiv: boolean;   // preço caindo, WT subindo = sinal de alta
  bearishDiv: boolean;   // preço subindo, WT caindo = sinal de baixa
  // Sinal consolidado
  signal: "compra" | "venda" | null;
  overbought: boolean;   // WT > 60
  oversold: boolean;     // WT < -60
}

// ── EMA ──────────────────────────────────────────────────────────────────────
function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
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

// ── WaveTrend (baseado em close) ─────────────────────────────────────────────
function computeWaveTrend(closes: number[], n1 = 10, n2 = 21): { wt1: number[]; wt2: number[] } {
  if (closes.length < n1 + n2 + 4) return { wt1: [], wt2: [] };

  const esa = ema(closes, n1);
  // d = EMA(|close - esa|, n1)
  const diff = esa.map((e, i) => Math.abs(closes[i + (closes.length - esa.length)] - e));
  const d = ema(diff, n1);

  // ci = (close - esa) / (0.015 * d)
  const off = closes.length - d.length;
  const ci = d.map((di, i) => {
    const c = closes[i + off + (esa.length - d.length)];
    const e = esa[i + (esa.length - d.length)];
    return di === 0 ? 0 : (c - e) / (0.015 * di);
  });

  const wt1 = ema(ci, n2);
  const wt2 = ema(wt1, 4);

  return { wt1, wt2 };
}

// ── RSI ──────────────────────────────────────────────────────────────────────
function computeRsi(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  const rsiValues: number[] = [];
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }
  return rsiValues;
}

// ── Stochastic RSI ───────────────────────────────────────────────────────────
function computeStochRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14): number[] {
  const rsi = computeRsi(closes, rsiPeriod);
  if (rsi.length < stochPeriod) return [];
  const result: number[] = [];
  for (let i = stochPeriod - 1; i < rsi.length; i++) {
    const window = rsi.slice(i - stochPeriod + 1, i + 1);
    const lo = Math.min(...window);
    const hi = Math.max(...window);
    result.push(hi === lo ? 0 : ((rsi[i] - lo) / (hi - lo)) * 100);
  }
  return result;
}

// ── Divergência simples (últimos 5 picos/vales) ───────────────────────────────
function detectDivergence(
  price: number[],
  oscillator: number[],
  lookback = 5
): { bullish: boolean; bearish: boolean } {
  if (price.length < lookback + 1 || oscillator.length < lookback + 1) {
    return { bullish: false, bearish: false };
  }

  const pSlice = price.slice(-lookback - 1);
  const oSlice = oscillator.slice(-lookback - 1);

  const pNow = pSlice[pSlice.length - 1];
  const pPrev = Math.min(...pSlice.slice(0, -1));
  const oNow = oSlice[oSlice.length - 1];
  const oPrev = oSlice[pSlice.indexOf(pPrev)];

  // Bullish: preço faz mínima mais baixa, WT faz mínima mais alta
  const bullish = pNow < pPrev && oNow > oPrev && oNow < -40;
  // Bearish: preço faz máxima mais alta, WT faz máxima mais baixa
  const pPrevHi = Math.max(...pSlice.slice(0, -1));
  const oPrevHi = oSlice[pSlice.indexOf(pPrevHi)];
  const bearish = pNow > pPrevHi && oNow < oPrevHi && oNow > 40;

  return { bullish, bearish };
}

// ── API pública ───────────────────────────────────────────────────────────────
// Mínimo de candles: ~60 (para ter todas as EMAs convergidas)
export function computeCipherB(closes: number[]): CipherBResult | null {
  if (closes.length < 60) return null;

  const { wt1: wt1arr, wt2: wt2arr } = computeWaveTrend(closes);
  if (wt1arr.length === 0 || wt2arr.length === 0) return null;

  const rsiArr = computeRsi(closes);
  const stochArr = computeStochRsi(closes);

  const wt1 = wt1arr[wt1arr.length - 1];
  const wt2 = wt2arr[wt2arr.length - 1];
  const rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : 50;
  const stochRsi = stochArr.length > 0 ? stochArr[stochArr.length - 1] : 50;

  const { bullish: bullishDiv, bearish: bearishDiv } = detectDivergence(closes, wt1arr);

  // Cruzamento: sinal de compra quando WT1 cruza WT2 de baixo para cima na zona de sobrevenda
  const prevWt1 = wt1arr.length >= 2 ? wt1arr[wt1arr.length - 2] : wt1;
  const prevWt2 = wt2arr.length >= 2 ? wt2arr[wt2arr.length - 2] : wt2;
  const crossUp = prevWt1 < prevWt2 && wt1 > wt2;
  const crossDown = prevWt1 > prevWt2 && wt1 < wt2;

  let signal: CipherBResult["signal"] = null;
  if ((crossUp && wt1 < 0) || bullishDiv) signal = "compra";
  else if ((crossDown && wt1 > 0) || bearishDiv) signal = "venda";

  return {
    wt1,
    wt2,
    rsi,
    stochRsi,
    bullishDiv,
    bearishDiv,
    signal,
    overbought: wt1 > 60,
    oversold: wt1 < -60,
  };
}

export function cipherBSignal(result: CipherBResult | null): "compra" | "venda" | null {
  return result?.signal ?? null;
}
