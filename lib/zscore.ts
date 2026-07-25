export interface ZScoreResult {
  zScore: number;
  changePct: number;
  sampleSize: number;
  reliable: boolean;
}

const MIN_RELIABLE_SAMPLE = 10;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Z-score da variação de hoje em relação à média/desvio das variações diárias dos
// últimos `window` pregões anteriores. Amostra <10 pregões é sinalizada como não confiável.
export function computeZScore(closes: number[], window = 30): ZScoreResult | null {
  if (closes.length < 2) return null;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
  }

  const changePct = changes[changes.length - 1];
  const historical = changes.slice(0, -1).slice(-window);

  if (historical.length === 0) {
    return { zScore: 0, changePct, sampleSize: 0, reliable: false };
  }

  const avg = mean(historical);
  const sd = stdDev(historical, avg);
  const zScore = sd === 0 ? 0 : (changePct - avg) / sd;

  return {
    zScore,
    changePct,
    sampleSize: historical.length,
    reliable: historical.length >= MIN_RELIABLE_SAMPLE,
  };
}
