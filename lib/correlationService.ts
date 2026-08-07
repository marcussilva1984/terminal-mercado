import { hasDatabase } from "@/lib/db/client";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { getWatchlist } from "@/lib/db/watchlistRepo";

export interface CorrelationPair {
  symbolA: string;
  labelA: string;
  symbolB: string;
  labelB: string;
  correlation: number;
  points: number;
}

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 5) return null;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

// Retorna as correlações mais fortes (positivas e negativas) entre pares de
// ativos da watchlist — mede o quanto os preços andam juntos, com base nos
// retornos diários já coletados pelo cron (price_series). Útil pra enxergar
// concentração de risco: ativos com correlação muito alta se movem juntos,
// então não diversificam tanto quanto parece.
export async function getWatchlistCorrelations(maxPairs = 15): Promise<CorrelationPair[]> {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL não configurada — correlação precisa do histórico salvo no banco.");
  }

  const items = await getWatchlist();
  const returnsBySymbol: { symbol: string; label: string; assetClass: string; returnsByDate: Map<string, number> }[] = [];

  for (const item of items) {
    const closes = await getCloses(item.symbol, item.assetClass, 60);
    if (closes.length < 6) continue;
    const returnsByDate = new Map<string, number>();
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1].closePrice;
      if (prev === 0) continue;
      returnsByDate.set(closes[i].date, (closes[i].closePrice - prev) / prev);
    }
    returnsBySymbol.push({ symbol: item.symbol, label: item.label, assetClass: item.assetClass, returnsByDate });
  }

  const pairs: CorrelationPair[] = [];
  for (let i = 0; i < returnsBySymbol.length; i++) {
    for (let j = i + 1; j < returnsBySymbol.length; j++) {
      const x = returnsBySymbol[i];
      const y = returnsBySymbol[j];
      const commonDates = [...x.returnsByDate.keys()].filter((d) => y.returnsByDate.has(d));
      if (commonDates.length < 5) continue;

      const a = commonDates.map((d) => x.returnsByDate.get(d) as number);
      const b = commonDates.map((d) => y.returnsByDate.get(d) as number);
      const correlation = pearson(a, b);
      if (correlation === null) continue;

      pairs.push({
        symbolA: x.symbol,
        labelA: x.label,
        symbolB: y.symbol,
        labelB: y.label,
        correlation,
        points: commonDates.length,
      });
    }
  }

  pairs.sort((p1, p2) => Math.abs(p2.correlation) - Math.abs(p1.correlation));
  return pairs.slice(0, maxPairs);
}

export interface BenchmarkCorrelation {
  symbol: string;
  label: string;
  benchmark: string;
  correlation: number;
  beta: number;
  points: number;
}

const BENCHMARKS = [
  { symbol: "IBOV", label: "Ibovespa" },
  { symbol: "SPX", label: "S&P 500" },
  { symbol: "DXY", label: "Índice Dólar (DXY)" },
] as const;

function returnsByDateFor(closes: { date: string; closePrice: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1].closePrice;
    if (prev === 0) continue;
    map.set(closes[i].date, (closes[i].closePrice - prev) / prev);
  }
  return map;
}

// Beta e correlação de cada item (watchlist ou item avulso, ex.: posição da
// carteira) contra os 3 benchmarks fixos (IBOV, S&P 500, DXY) — "seu ativo X
// se move quanto em relação ao mercado", não só entre si.
export async function getBenchmarkCorrelations(
  items: { symbol: string; label: string; assetClass: string }[]
): Promise<BenchmarkCorrelation[]> {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL não configurada — correlação precisa do histórico salvo no banco.");
  }

  const benchmarkReturns = new Map<string, Map<string, number>>();
  for (const b of BENCHMARKS) {
    const closes = await getCloses(b.symbol, "indice", 60);
    if (closes.length >= 6) benchmarkReturns.set(b.symbol, returnsByDateFor(closes));
  }

  const results: BenchmarkCorrelation[] = [];
  for (const item of items) {
    const closes = await getCloses(item.symbol, item.assetClass, 60);
    if (closes.length < 6) continue;
    const itemReturns = returnsByDateFor(closes);

    for (const b of BENCHMARKS) {
      const benchReturns = benchmarkReturns.get(b.symbol);
      if (!benchReturns) continue;

      const commonDates = [...itemReturns.keys()].filter((d) => benchReturns.has(d));
      if (commonDates.length < 5) continue;

      const a = commonDates.map((d) => itemReturns.get(d) as number);
      const c = commonDates.map((d) => benchReturns.get(d) as number);
      const correlation = pearson(a, c);
      if (correlation === null) continue;

      const meanC = c.reduce((s, v) => s + v, 0) / c.length;
      const varC = c.reduce((s, v) => s + (v - meanC) ** 2, 0);
      const meanA = a.reduce((s, v) => s + v, 0) / a.length;
      const covAC = a.reduce((s, v, i) => s + (v - meanA) * (c[i] - meanC), 0);
      const beta = varC === 0 ? 0 : covAC / varC;

      results.push({ symbol: item.symbol, label: item.label, benchmark: b.label, correlation, beta, points: commonDates.length });
    }
  }

  return results;
}
