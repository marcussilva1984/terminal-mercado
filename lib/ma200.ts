export interface Ma200Result {
  ma200: number;
  aboveMA: boolean;  // preço acima da MA200
  distPct: number;   // distância percentual do preço à MA200
}

export function computeMa200(closes: number[]): Ma200Result | null {
  if (closes.length < 200) return null;
  const last200 = closes.slice(-200);
  const ma200 = last200.reduce((a, b) => a + b, 0) / 200;
  const price = closes[closes.length - 1];
  return {
    ma200,
    aboveMA: price >= ma200,
    distPct: ((price - ma200) / ma200) * 100,
  };
}
