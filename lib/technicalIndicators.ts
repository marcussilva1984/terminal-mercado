// RSI e Bollinger Bands calculados só a partir de fechamento diário (mesma
// fonte já usada pelo SMA200/Monte Carlo) — sem fonte nova, sem custo extra.
// Períodos mais longos que o padrão de manual técnico (RSI-14, Bollinger-20)
// de propósito: o usuário opera sempre longo prazo, nunca daytrade.

export interface RsiResult {
  value: number;
  period: number;
}

// RSI clássico (média de ganhos/perdas suavizada, método de Wilder).
// period=21 (~1 mês de pregões) em vez do padrão 14 — janela mais longa
// suaviza ruído de curto prazo, mais alinhado a uma leitura de médio/longo
// prazo do que o RSI-14 tradicional (pensado pra swing trade).
export function computeRsi(closes: number[], period = 21): RsiResult | null {
  if (closes.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const relevant = changes.slice(-(period + 1));
  let avgGain = 0;
  let avgLoss = 0;
  for (const c of relevant.slice(0, period)) {
    if (c > 0) avgGain += c;
    else avgLoss += -c;
  }
  avgGain /= period;
  avgLoss /= period;

  // Suavização de Wilder pro restante da série (mesmo método usado pela
  // maioria das plataformas — evita que o RSI só reflita a última janela crua).
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return { value: 100, period };
  const rs = avgGain / avgLoss;
  const value = 100 - 100 / (1 + rs);
  return { value, period };
}

export interface BollingerResult {
  price: number;
  middle: number; // SMA
  upper: number;
  lower: number;
  percentB: number; // 0 = na banda inferior, 1 = na banda superior, pode passar de 0-1
  period: number;
}

// Bandas de Bollinger = SMA ± (multiplicador × desvio-padrão). period=50 em
// vez do padrão 20 — mesmo raciocínio do RSI, janela mais longa pra leitura
// de longo prazo em vez do padrão de swing trade.
export function computeBollingerBands(closes: number[], period = 50, stdDevMultiplier = 2): BollingerResult | null {
  if (closes.length < period) return null;

  const window = closes.slice(-period);
  const middle = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDevMultiplier * stdDev;
  const lower = middle - stdDevMultiplier * stdDev;
  const price = closes[closes.length - 1];
  const percentB = upper === lower ? 0.5 : (price - lower) / (upper - lower);

  return { price, middle, upper, lower, percentB, period };
}
