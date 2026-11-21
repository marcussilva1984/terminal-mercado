import { getCloses } from "@/lib/db/priceSeriesRepo";
import { hasDatabase } from "@/lib/db/client";

export interface BtcCorrelation {
  symbol: string;
  label: string;
  correlation30d: number; // Pearson -1..1
  selfChange30d: number;  // variação do ativo em 30d
  btcChange30d: number;   // variação do BTC em 30d
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const ax = a.slice(-n);
  const bx = b.slice(-n);
  const meanA = ax.reduce((s, v) => s + v, 0) / n;
  const meanB = bx.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const dA = ax[i] - meanA;
    const dB = bx[i] - meanB;
    num += dA * dB;
    da += dA * dA;
    db += dB * dB;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

function dailyReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    r.push(closes[i - 1] === 0 ? 0 : (closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return r;
}

export async function getBtcCorrelations(
  watchlist: { symbol: string; label: string }[]
): Promise<BtcCorrelation[]> {
  if (!hasDatabase()) return [];

  const btcCloses = await getCloses("BTC", "cripto", 35);
  if (btcCloses.length < 5) return [];

  const btcPrices = btcCloses.map((c) => c.closePrice);
  const btcReturns = dailyReturns(btcPrices);
  const btcChange30d =
    btcPrices.length >= 31
      ? ((btcPrices[btcPrices.length - 1] - btcPrices[btcPrices.length - 31]) / btcPrices[btcPrices.length - 31]) * 100
      : 0;

  const results: BtcCorrelation[] = [];
  await Promise.all(
    watchlist
      .filter((w) => w.symbol.toUpperCase() !== "BTC")
      .map(async ({ symbol, label }) => {
        const closes = await getCloses(symbol, "cripto", 35);
        if (closes.length < 5) return;
        const prices = closes.map((c) => c.closePrice);
        const returns = dailyReturns(prices);
        const corr = pearson(returns, btcReturns);
        const selfChange30d =
          prices.length >= 31
            ? ((prices[prices.length - 1] - prices[prices.length - 31]) / prices[prices.length - 31]) * 100
            : 0;
        results.push({ symbol, label, correlation30d: corr, selfChange30d, btcChange30d });
      })
  );

  return results.sort((a, b) => a.correlation30d - b.correlation30d);
}
