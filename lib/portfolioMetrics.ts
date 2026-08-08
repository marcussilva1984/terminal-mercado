import { getCloses } from "@/lib/db/priceSeriesRepo";
import { getDividendHistory, getFiiDividendHistory } from "@/lib/sources/fundamentus";

export interface DrawdownResult {
  maxDrawdownPct: number; // negativo, ex: -18.5 = caiu 18.5% do topo
  peakDate: string;
  troughDate: string;
  points: number;
}

// Maior queda desde o topo (histórico coletado, não desde a compra) — métrica
// de risco padrão de mesa profissional. Só reflete o período que já temos
// dado coletado (cron roda 1x/dia), não o histórico de vida inteira do ativo.
export async function getMaxDrawdown(symbol: string, assetClass: string): Promise<DrawdownResult | null> {
  const closes = await getCloses(symbol, assetClass, 60);
  if (closes.length < 5) return null;

  let peak = closes[0].closePrice;
  let peakDate = closes[0].date;
  let maxDrawdownPct = 0;
  let troughDate = closes[0].date;

  for (const c of closes) {
    if (c.closePrice > peak) {
      peak = c.closePrice;
      peakDate = c.date;
    }
    const drawdownPct = ((c.closePrice - peak) / peak) * 100;
    if (drawdownPct < maxDrawdownPct) {
      maxDrawdownPct = drawdownPct;
      troughDate = c.date;
    }
  }

  return { maxDrawdownPct, peakDate, troughDate, points: closes.length };
}

export interface DividendsReceivedInput {
  symbol: string;
  assetClass: string;
  quantity: number;
  sinceDate: string; // ISO — usamos a data de cadastro da posição como proxy de "desde quando";
  // não é a data de compra real (não coletamos isso), então o total pode
  // divergir do que você recebeu de fato se cadastrou a posição depois de
  // já ter comprado.
}

export interface DividendsReceivedResult {
  symbol: string;
  totalReceived: number;
  paymentsCount: number;
}

// Fundamentus só cobre B3/FII (não tem proventos de stocks EUA/cripto de
// graça numa fonte só) — chamado apenas pra esses dois.
export async function getDividendsReceived(holdings: DividendsReceivedInput[]): Promise<DividendsReceivedResult[]> {
  const results: DividendsReceivedResult[] = [];
  for (const h of holdings) {
    if (h.assetClass !== "b3" && h.assetClass !== "fii") continue;
    try {
      const history = h.assetClass === "fii" ? await getFiiDividendHistory(h.symbol) : await getDividendHistory(h.symbol);
      const relevant = history.filter((p) => p.date >= h.sinceDate);
      if (relevant.length === 0) continue;
      const totalReceived = relevant.reduce((sum, p) => sum + p.valuePerShare * h.quantity, 0);
      results.push({ symbol: h.symbol, totalReceived, paymentsCount: relevant.length });
    } catch {
      // fonte indisponível pra esse papel — segue pros demais
    }
  }
  return results;
}

export interface PortfolioSharpeInput {
  symbol: string;
  assetClass: string;
  weight: number; // fração do valor total da carteira (0-1)
}

export interface SharpeResult {
  sharpeRatio: number;
  annualizedReturnPct: number;
  annualizedVolPct: number;
  points: number;
}

// Sharpe simplificado (sem taxa livre de risco, retorno diário anualizado
// por sqrt(252)) — aproximação: pondera pela participação de cada posição
// no valor total, mas SEM conversão cambial entre BRL/USD (ativos em moedas
// diferentes têm o retorno % tratado igual, o que é uma simplificação real,
// não um erro de cálculo — deixado explícito na UI).
export async function getPortfolioSharpe(holdings: PortfolioSharpeInput[]): Promise<SharpeResult | null> {
  const returnsBySymbol = new Map<string, Map<string, number>>();

  for (const h of holdings) {
    const closes = await getCloses(h.symbol, h.assetClass, 60);
    if (closes.length < 6) continue;
    const returns = new Map<string, number>();
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1].closePrice;
      if (prev === 0) continue;
      returns.set(closes[i].date, (closes[i].closePrice - prev) / prev);
    }
    returnsBySymbol.set(h.symbol, returns);
  }

  if (returnsBySymbol.size === 0) return null;

  const allDates = new Set<string>();
  for (const returns of returnsBySymbol.values()) {
    for (const date of returns.keys()) allDates.add(date);
  }

  const portfolioReturns: number[] = [];
  for (const date of [...allDates].sort()) {
    let weightedReturn = 0;
    let weightSum = 0;
    for (const h of holdings) {
      const r = returnsBySymbol.get(h.symbol)?.get(date);
      if (r === undefined) continue;
      weightedReturn += r * h.weight;
      weightSum += h.weight;
    }
    if (weightSum > 0) portfolioReturns.push(weightedReturn / weightSum);
  }

  if (portfolioReturns.length < 5) return null;

  const mean = portfolioReturns.reduce((s, v) => s + v, 0) / portfolioReturns.length;
  const variance = portfolioReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / portfolioReturns.length;
  const stdev = Math.sqrt(variance);

  const annualizedReturnPct = mean * 252 * 100;
  const annualizedVolPct = stdev * Math.sqrt(252) * 100;
  const sharpeRatio = stdev === 0 ? 0 : (mean * 252) / (stdev * Math.sqrt(252));

  return { sharpeRatio, annualizedReturnPct, annualizedVolPct, points: portfolioReturns.length };
}
