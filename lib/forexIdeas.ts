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
  carryAligned: boolean;
  isDistortion: boolean; // movimento vai CONTRA o carry — potencial desconto exagerado
}

// Central bank policy rates (%, updated manually — see updatedAt below)
export const CARRY_RATES: Record<string, number> = {
  NZD: 5.50, USD: 5.25, GBP: 5.00, CAD: 4.75,
  AUD: 4.35, EUR: 3.75, CHF: 1.50, JPY: 0.10,
};
export const CARRY_RATES_DATE = "2026-08-22";

const RATES = CARRY_RATES;

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
    carryAligned: boolean;
    isDistortion: boolean;
  }

  const candidates: Candidate[] = [];

  ANALYSIS_PAIRS.forEach((p, i) => {
    const day = dayResults[i].status === "fulfilled" ? dayResults[i].value : null;
    const week = weekResults[i].status === "fulfilled" ? weekResults[i].value : null;
    if (day === null || week === null) return;

    const sameDir = (day > 0 && week > 0) || (day < 0 && week < 0);
    if (!sameDir) return; // need consistency across timeframes

    const direction: "alta" | "queda" = day > 0 ? "alta" : "queda";
    const absDay = Math.abs(day);
    const absWeek = Math.abs(week);

    const cp = carryPp(p.base, p.quote);
    const carryAligned =
      cp !== undefined && ((direction === "alta" && cp > 0) || (direction === "queda" && cp < 0));

    // Distortion: price moves AGAINST carry — potential deep discount reversal opportunity
    const isDistortion =
      cp !== undefined &&
      Math.abs(cp) >= 2.0 && // meaningful carry differential
      !carryAligned &&        // moving against carry
      absWeek >= 1.5;         // significant weekly move (real distortion, not noise)

    // Positive carry bias: strong bonus when carry and direction align
    const carryBonus = carryAligned ? Math.abs(cp ?? 0) * 0.2 : 0;
    // Distortion gets a moderate score (mean-reversion opportunity)
    const distortionBonus = isDistortion ? Math.abs(cp ?? 0) * 0.1 : 0;

    const score = absDay + absWeek * 0.6 + carryBonus + distortionBonus;

    let conviction: "forte" | "medio" | "fraco";
    if (absDay >= 0.3 && absWeek >= 1.0) conviction = "forte";
    else if (absDay >= 0.15 || absWeek >= 0.5) conviction = "medio";
    else conviction = "fraco";

    // Upgrade conviction if carry strongly aligned
    if (conviction === "medio" && carryAligned && Math.abs(cp ?? 0) >= 3.0) conviction = "forte";

    candidates.push({ pair: p.pair, base: p.base, quote: p.quote, direction, dayPct: day, weekPct: week, score, conviction, carryPp: cp, carryAligned, isDistortion });
  });

  // Sort: positive-carry-aligned first within each conviction tier
  candidates.sort((a, b) => {
    if (a.conviction !== b.conviction) {
      const order = { forte: 0, medio: 1, fraco: 2 };
      return order[a.conviction] - order[b.conviction];
    }
    return b.score - a.score;
  });

  // Separate: carry-aligned ideas vs distortion opportunities
  const carryIdeas = candidates.filter((c) => c.carryAligned && !c.isDistortion);
  const distortionIdeas = candidates.filter((c) => c.isDistortion);
  const neutralIdeas = candidates.filter((c) => !c.carryAligned && !c.isDistortion);

  const top = [...carryIdeas.slice(0, 5), ...neutralIdeas.slice(0, 3), ...distortionIdeas.slice(0, 2)];
  const forte = top.filter((c) => c.conviction === "forte");

  // Hedge suggestions: non-overlapping currencies for top carry ideas
  const hedges: Candidate[] = [];
  for (const idea of forte.filter((c) => c.carryAligned).slice(0, 3)) {
    const hedge = candidates.find(
      (c) => !sharedCurrency(idea.pair, c.pair) && !top.some((t) => t.pair === c.pair) && !hedges.some((h) => h.pair === c.pair)
    );
    if (hedge) hedges.push({ ...hedge, conviction: "forte" });
  }

  const buildIdea = (c: Candidate, isHedge: boolean, hedgeFor?: string): ForexIdea => {
    const dirLabel = c.direction === "alta" ? "alta" : "queda";
    const carryStr = c.carryPp !== undefined ? ` | Carry: ${c.carryPp > 0 ? "+" : ""}${c.carryPp.toFixed(2)}pp` : "";

    let label: string;
    let rationale: string;

    if (isHedge) {
      label = `Hedge sugerido: ${c.pair} (${dirLabel})`;
      rationale = `Não compartilha moeda com "${hedgeFor}" — diversifica exposição sem concentrar numa moeda só.${carryStr}`;
    } else if (c.isDistortion) {
      label = `${c.pair}: distorção — carry positivo mas preço caindo`;
      rationale = `Carry favorável de ${c.carryPp !== undefined ? Math.abs(c.carryPp).toFixed(2) : "?"}pp, mas semanal ${c.weekPct > 0 ? "+" : ""}${c.weekPct.toFixed(2)}% contra o carry — possível desconto exagerado. Aguardar confirmação de reversão.`;
    } else {
      const carryNote = c.carryAligned ? " Carry positivo alinhado." : "";
      label = `${c.pair}: ${dirLabel} consistente (diário e semanal)`;
      rationale = `Variação diária ${c.dayPct > 0 ? "+" : ""}${c.dayPct.toFixed(2)}% e semanal ${c.weekPct > 0 ? "+" : ""}${c.weekPct.toFixed(2)}% na mesma direção — não é só ruído de um dia.${carryNote}${carryStr}`;
    }

    return { pair: c.pair, direction: c.direction, label, rationale, conviction: c.conviction, isHedge, hedgeFor, dayPct: c.dayPct, weekPct: c.weekPct, carryPp: c.carryPp, carryAligned: c.carryAligned, isDistortion: c.isDistortion };
  };

  const ideas: ForexIdea[] = [
    ...top.map((c) => buildIdea(c, false)),
    ...hedges.map((h, i) => buildIdea(h, true, forte.filter((c) => c.carryAligned)[i]?.pair)),
  ];

  return { ideas, updatedAt: new Date().toISOString() };
}
