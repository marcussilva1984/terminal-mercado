import { getYahooQuote, getYahooQuotes } from "@/lib/sources/yahoo";

export const G8_CURRENCIES = ["USD", "EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD"] as const;
export type G8Currency = (typeof G8_CURRENCIES)[number];

// Pares usados para chegar ao valor de cada moeda em USD. As quatro primeiras já
// cotam em USD por unidade; as três com USD na frente precisam ser invertidas (1/rate).
const USD_QUOTED_DIRECT = { EUR: "EURUSD=X", GBP: "GBPUSD=X", AUD: "AUDUSD=X", NZD: "NZDUSD=X" } as const;
const USD_QUOTED_INVERSE = { JPY: "USDJPY=X", CHF: "USDCHF=X", CAD: "USDCAD=X" } as const;

export interface ForexPairQuote {
  pair: string;
  label: string;
  price: number;
  changePct: number;
}

const MAIN_PAIRS: { symbol: string; pair: string; label: string }[] = [
  { symbol: "EURUSD=X", pair: "EUR/USD", label: "Euro" },
  { symbol: "GBPUSD=X", pair: "GBP/USD", label: "Libra Esterlina" },
  { symbol: "USDJPY=X", pair: "USD/JPY", label: "Iene Japonês" },
  { symbol: "USDCHF=X", pair: "USD/CHF", label: "Franco Suíço" },
  { symbol: "USDCAD=X", pair: "USD/CAD", label: "Dólar Canadense" },
  { symbol: "AUDUSD=X", pair: "AUD/USD", label: "Dólar Australiano" },
  { symbol: "NZDUSD=X", pair: "NZD/USD", label: "Dólar Neozelandês" },
  { symbol: "BRL=X", pair: "USD/BRL", label: "Real Brasileiro" },
  { symbol: "GBPAUD=X", pair: "GBP/AUD", label: "Libra x Dólar Australiano" },
  { symbol: "GBPNZD=X", pair: "GBP/NZD", label: "Libra x Dólar Neozelandês" },
  { symbol: "EURAUD=X", pair: "EUR/AUD", label: "Euro x Dólar Australiano" },
  { symbol: "EURNZD=X", pair: "EUR/NZD", label: "Euro x Dólar Neozelandês" },
];

export async function getForexPairs(): Promise<ForexPairQuote[]> {
  const quotes = await getYahooQuotes(MAIN_PAIRS.map((p) => p.symbol));
  return MAIN_PAIRS.filter((p) => quotes[p.symbol]).map((p) => ({
    pair: p.pair,
    label: p.label,
    price: quotes[p.symbol].price,
    changePct: quotes[p.symbol].changePct,
  }));
}

export interface CurrencyStrength {
  currency: G8Currency;
  score: number; // % médio de variação contra a cesta das outras 7 moedas
}

// Calcula a variação de cada moeda G8 em relação ao USD e deriva um score médio
// contra a cesta das outras 7 (aproximação por diferença de variações USD-relativas,
// método comum em strength meters de varejo — não são 28 pares cruzados reais).
export async function getCurrencyStrength(): Promise<CurrencyStrength[]> {
  const symbols = [...Object.values(USD_QUOTED_DIRECT), ...Object.values(USD_QUOTED_INVERSE)];
  const quotes = await getYahooQuotes(symbols);

  const changeVsUsd: Record<G8Currency, number> = { USD: 0 } as Record<G8Currency, number>;

  for (const [ccy, symbol] of Object.entries(USD_QUOTED_DIRECT)) {
    const q = quotes[symbol];
    if (q) changeVsUsd[ccy as G8Currency] = q.changePct;
  }
  for (const [ccy, symbol] of Object.entries(USD_QUOTED_INVERSE)) {
    const q = quotes[symbol];
    if (q) changeVsUsd[ccy as G8Currency] = -q.changePct;
  }

  const available = Object.keys(changeVsUsd) as G8Currency[];
  if (available.length < 4) throw new Error("Dados insuficientes para o currency strength meter");

  const scores: CurrencyStrength[] = available.map((ccy) => {
    const others = available.filter((c) => c !== ccy);
    const avgOthers = others.reduce((sum, c) => sum + changeVsUsd[c], 0) / others.length;
    const score = changeVsUsd[ccy] - avgOthers;
    return { currency: ccy, score };
  });

  return scores.sort((a, b) => b.score - a.score);
}

export async function getDXY() {
  return getYahooQuote("DX-Y.NYB");
}

export interface YieldPoint {
  label: string;
  yieldPct: number;
  changePct: number;
}

const US_YIELD_SYMBOLS = [
  { symbol: "^IRX", label: "EUA 13 sem." },
  { symbol: "^FVX", label: "EUA 5 anos" },
  { symbol: "^TNX", label: "EUA 10 anos" },
  { symbol: "^TYX", label: "EUA 30 anos" },
];

export async function getUSYieldCurve(): Promise<YieldPoint[]> {
  const quotes = await getYahooQuotes(US_YIELD_SYMBOLS.map((y) => y.symbol));
  return US_YIELD_SYMBOLS.filter((y) => quotes[y.symbol]).map((y) => ({
    label: y.label,
    yieldPct: quotes[y.symbol].price,
    changePct: quotes[y.symbol].changePct,
  }));
}
