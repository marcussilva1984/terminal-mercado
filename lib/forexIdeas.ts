import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";

export interface ForexIdea {
  pair: string;
  direction: "alta" | "queda";
  label: string;
  rationale: string;
  conviction: "forte" | "medio" | "fraco";
  isHedge: boolean;
  hedgeFor?: string;
  dayPct: number;
  weekPct: number;
  carryPp?: number;
}

// Central bank rates (approximate, updated manually)
const RATES: Record<string, number> = {
  USD: 5.25, EUR: 3.75, GBP: 5.00, JPY: 0.10,
  AUD: 4.35, NZD: 5.50, CAD: 4.75, CHF: 1.50,
};

function carryPp(base: string, quote: string): number | undefined {
  if (RATES[base] === undefined || RATES[quote] === undefined) return undefined;
  return RATES[base] - RATES[quote];
}

const ANALYSIS_PAIRS: { symbol: string; pair: string; base: string; quote: string }[] = [
  { symbol: "EURUSD=X", pair: "EUR/USD", base: "EUR", quote: "USD" },
  { symbol: "GBPUSD=X", pair: "GBP/USD", base: "GBP", quote: "USD" },
  { symbol: "USDJPY=X", pair: "USD/JPY", base: "USD", quote: "JPY" },
  { symbol: "USDCHF=X", pair: "USD/CHF", base: "USD", quote: "CHF" },
  { symbol: "USDCAD=X", pair: "USD/CAD", base: "USD", quote: "CAD" },
  { symbol: "AUDUSD=X", pair: "AUD/USD", base: "AUD", quote: "USD" },
  { symbol: "NZDUSD=X", pair: "NZD/USD", base: "NZD", quote: "USD" },
  { symbol: "EURGBP=X", pair: "EUR/GBP", base: "EUR", quote: "GBP" },
  { symbol: "EURJPY=X", pair: "EUR/JPY", base: "EUR", quote: "JPY" },
  { symbol: "EURAUD=X", pair: "EUR/AUD", base: "EUR", quote: "AUD" },
  { symbol: "EURNZD=X", pair: "EUR/NZD", base: "EUR", quote: "NZD" },
  { symbol: "EURCHF=X", pair: "EUR/CHF", base: "EUR", quote: "CHF" },
  { symbol: "GBPJPY=X", pair: "GBP/JPY", base: "GBP", quote: "JPY" },
  { symbol: "GBPAUD=X", pair: "GBP/AUD", base: "GBP", quote: "AUD" },
  { symbol: "GBPNZD=X", pair: "GBP/NZD", base: "GBP", quote: "NZD" },
  { symbol: "GBPCHF=X", pair: "GBP/CHF", base: "GBP", quote: "CHF" },
  { symbol: "AUDJPY=X", pair: "AUD/JPY", base: "AUD", quote: "JPY" },
  { symbol: "NZDJPY=X", pair: "NZD/JPY", base: "NZD", quote: "JPY" },
  { symbol: "CADJPY=X", pair: "CAD/JPY", base: "CAD", quote: "JPY" },
  { symbol: "CHFJPY=X", pair: "CHF/JPY", base: "CHF", quote: "JPY" },
  { symbol: "AUDCHF=X", pair: "AUD/CHF", base: "AUD", quote: "CHF" },
  { symbol: "NZDCHF=X", pair: "NZD/CHF", base: "NZD", quote: "CHF" },
  { symbol: "AUDNZD=X", pair: "AUD/NZD", base: "AUD", quote: "NZD" },
  { symbol: "CADCHF=X", pair: "CAD/CHF", base: "CAD", quote: "CHF" },
];

async function fetchWeeklyChangePct(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_USER_AGENT },
      next: { revalidate: 3600 }, // weekly changes don't need to refresh often
    });
    if (!res.ok) return null;
    const json = await res.json();
    const closes: (number | null)[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c): c is number => typeof c === "number" && c > 0);
    if (valid.length < 6) return null;
    const weekAgo = valid[valid.length - 6];
    const latest = valid[valid.length - 1];
    return ((latest - weekAgo) / weekAgo) * 100;
  } catch {
    return null;
  }
}

async function fetchDayChangePct(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_USER_AGENT },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    return prev ? ((price - prev) / prev) * 100 : null;
  } catch {
    return null;
  }
}

function sharedCurrency(pairA: string, pairB: string): boolean {
  const [a1, a2] = pairA.split("/");
  const [b1, b2] = pairB.split("/");
  return a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2;
}

export async function getForexIdeas(): Promise<{ ideas: ForexIdea[]; updatedAt: string }> {
  const [dayResults, weekResults] = await Promise.all([
    Promise.allSettled(ANALYSIS_PAIRS.map((p) => fetchDayChangePct(p.symbol))),
    Promise.allSettled(ANALYSIS_PAIRS.map((p) => fetchWeeklyChangePct(p.symbol))),
  ]);

  interface Candidate {
    pair: string;
    base: string;
    quote: string;
    direction: "alta" | "queda";
    dayPct: number;
    weekPct: number;
    score: number;
    conviction: "forte" | "medio" | "fraco";
    carryPp?: number;
  }

  const candidates: Candidate[] = [];

  ANALYSIS_PAIRS.forEach((p, i) => {
    const day = dayResults[i].status === "fulfilled" ? dayResults[i].value : null;
    const week = weekResults[i].status === "fulfilled" ? weekResults[i].value : null;
    if (day === null || week === null) return;

    const sameDir = (day > 0 && week > 0) || (day < 0 && week < 0);
    if (!sameDir) return; // only consistent signals

    const direction: "alta" | "queda" = day > 0 ? "alta" : "queda";
    const absDay = Math.abs(day);
    const absWeek = Math.abs(week);

    // Carry bonus
    const cp = carryPp(p.base, p.quote);
    const carryAligned =
      cp !== undefined && ((direction === "alta" && cp > 0) || (direction === "queda" && cp < 0));
    const carryBonus = carryAligned ? Math.abs(cp ?? 0) * 0.1 : 0;

    const score = absDay + absWeek * 0.6 + carryBonus;

    let conviction: "forte" | "medio" | "fraco";
    if (absDay >= 0.3 && absWeek >= 1.0) conviction = "forte";
    else if (absDay >= 0.15 || absWeek >= 0.5) conviction = "medio";
    else conviction = "fraco";

    candidates.push({ pair: p.pair, base: p.base, quote: p.quote, direction, dayPct: day, weekPct: week, score, conviction, carryPp: cp });
  });

  candidates.sort((a, b) => b.score - a.score);

  // Pick top ideas (at most 5 forte + 5 medio/fraco)
  const forte = candidates.filter((c) => c.conviction === "forte").slice(0, 5);
  const medio = candidates.filter((c) => c.conviction !== "forte").slice(0, 5);
  const top = [...forte, ...medio];

  // Build hedge suggestions (for each top forte, find best non-overlapping currency hedge)
  const hedges: Candidate[] = [];
  for (const idea of forte.slice(0, 3)) {
    // Find a strong candidate that doesn't share currency
    const hedge = candidates.find(
      (c) => !sharedCurrency(idea.pair, c.pair) && !top.some((t) => t.pair === c.pair)
    );
    if (hedge && !hedges.some((h) => h.pair === hedge.pair)) {
      hedges.push({ ...hedge, conviction: "forte" });
    }
  }

  const buildIdea = (c: Candidate, isHedge: boolean, hedgeFor?: string): ForexIdea => {
    const dirLabel = c.direction === "alta" ? "alta" : "queda";
    const sameLabel = "consistente (diário e semanal)";
    const carryLabel = c.carryPp !== undefined ? ` | Carry: ${c.carryPp > 0 ? "+" : ""}${c.carryPp.toFixed(2)}pp` : "";
    const label = isHedge
      ? `Hedge sugerido: ${c.pair} (${dirLabel})`
      : `${c.pair}: ${dirLabel} ${sameLabel}`;
    const rationale = isHedge
      ? `Não compartilha moeda com "${hedgeFor}" — serve pra não concentrar a aposta numa moeda só.${carryLabel}`
      : `Variação diária ${c.dayPct > 0 ? "+" : ""}${c.dayPct.toFixed(2)}% e semanal ${c.weekPct > 0 ? "+" : ""}${c.weekPct.toFixed(2)}% na mesma direção — não é só ruído de um dia.${carryLabel}`;

    return { pair: c.pair, direction: c.direction, label, rationale, conviction: c.conviction, isHedge, hedgeFor, dayPct: c.dayPct, weekPct: c.weekPct, carryPp: c.carryPp };
  };

  const ideas: ForexIdea[] = [
    ...top.map((c) => buildIdea(c, false)),
    ...hedges.map((h, i) => buildIdea(h, true, forte[i]?.pair)),
  ];

  return { ideas, updatedAt: new Date().toISOString() };
}
