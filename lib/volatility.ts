// Proxy de "risco/alavancagem" para B3 quando não existe fonte gratuita de short
// interest ou dívida/patrimônio: volatilidade (desvio-padrão dos retornos diários)
// calculada a partir do histórico já coletado em price_series. Não é o dado oficial
// pedido (mais alugadas/alavancadas) — é o proxy mais próximo que dá pra calcular
// com dado real, deixado explícito na UI.

export interface VolatilityResult {
  symbol: string;
  label: string;
  lastChangePct: number; // variação do último pregão
  vol1w: number; // desvio-padrão dos retornos diários, últimos 5 pregões
  vol1m: number; // desvio-padrão dos retornos diários, últimos 21 pregões
  sampleSize: number;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeVolatility(
  symbol: string,
  label: string,
  closes: number[]
): VolatilityResult | null {
  if (closes.length < 2) return null;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
  }

  return {
    symbol,
    label,
    lastChangePct: changes[changes.length - 1],
    vol1w: stdDev(changes.slice(-5)),
    vol1m: stdDev(changes.slice(-21)),
    sampleSize: changes.length,
  };
}
