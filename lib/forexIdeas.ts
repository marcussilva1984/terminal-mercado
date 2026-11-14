import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";
import { getPolicyRates, ratesToMap, type PolicyRate } from "@/lib/forexRates";
import { getCotPositions, type CotPosition } from "@/lib/sources/cot";

export type Direction = "alta" | "queda";
export type Conviction = "forte" | "medio" | "fraco";
export type IdeaKind = "carry" | "neutro" | "distorcao";

export const STOP_ATR = 1.5;
export const TARGET_ATR = 3;
const ATR_PERIOD = 14;

export interface TradeLevels {
  side: Direction; // na distorção é o lado do carry (contra o movimento recente)
  entry: number;
  stop: number;
  target: number;
  stopPips: number;
  targetPips: number;
  atr: number;
  carryPipsPerDay: number; // bruto, antes da taxa da corretora; positivo = recebe swap
}

export interface CotNote {
  buyCcy: string;
  sellCcy: string;
  buyIndex?: number;
  sellIndex?: number;
  score: number; // −50 (multidão já do seu lado) a +50 (multidão do lado oposto, no extremo)
  verdict: "lotado" | "espaco" | "neutro";
}

export interface ForexIdea {
  pair: string;
  symbol: string;
  direction: Direction;
  kind: IdeaKind;
  label: string;
  rationale: string;
  conviction: Conviction;
  isHedge: boolean;
  hedgeFor?: string;
  dayPct: number;
  weekPct: number;
  carryPp?: number;
  levels: TradeLevels | null;
  cot: CotNote | null;
}

export interface ForexIdeasResult {
  ideas: ForexIdea[];
  prices: Record<string, number>;
  rates: PolicyRate[];
  cot: CotPosition[];
  updatedAt: string;
}

export const ANALYSIS_PAIRS: { symbol: string; pair: string; base: string; quote: string }[] = [
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

export function pipSize(pair: string): number {
  return pair.endsWith("/JPY") ? 0.01 : 0.0001;
}

export function formatFx(pair: string, value: number): string {
  return value.toFixed(pair.endsWith("/JPY") ? 3 : 5);
}

export interface DailyBar {
  date: string; // YYYY-MM-DD
  high: number;
  low: number;
  close: number;
}

// Candles diários de forex no Yahoo vêm com timestamp de meia-noite de Londres
// (23:00 UTC no horário de verão) — o deslocamento de 6h garante a data certa.
export async function fetchDailyBars(symbol: string): Promise<DailyBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
  try {
    const res = await fetch(url, { headers: { "user-agent": BROWSER_USER_AGENT }, next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0] ?? {};
    const bars: DailyBar[] = [];
    ts.forEach((t, i) => {
      const high = q.high?.[i];
      const low = q.low?.[i];
      const close = q.close?.[i];
      if ([high, low, close].every((v) => typeof v === "number" && v > 0)) {
        const date = new Date((t + 6 * 3600) * 1000);
        // O Yahoo às vezes devolve a barra em aberto com data de sábado/domingo.
        if (date.getUTCDay() === 0 || date.getUTCDay() === 6) return;
        bars.push({ date: date.toISOString().slice(0, 10), high, low, close });
      }
    });
    return bars;
  } catch {
    return [];
  }
}

async function fetchQuote(symbol: string): Promise<{ price: number; changePct: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  try {
    const res = await fetch(url, { headers: { "user-agent": BROWSER_USER_AGENT }, next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    return { price, changePct: prev ? ((price - prev) / prev) * 100 : 0 };
  } catch {
    return null;
  }
}

function computeAtr(bars: DailyBar[]): number | null {
  if (bars.length < ATR_PERIOD + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const recent = trs.slice(-ATR_PERIOD);
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

function weekChangePct(bars: DailyBar[]): number | null {
  if (bars.length < 6) return null;
  const weekAgo = bars[bars.length - 6].close;
  return ((bars[bars.length - 1].close - weekAgo) / weekAgo) * 100;
}

function buildLevels(pair: string, side: Direction, entry: number, atr: number, carryPp: number | undefined): TradeLevels {
  const sign = side === "alta" ? 1 : -1;
  const pip = pipSize(pair);
  const tradeCarry = carryPp === undefined ? 0 : sign * carryPp;
  return {
    side,
    entry,
    stop: entry - sign * STOP_ATR * atr,
    target: entry + sign * TARGET_ATR * atr,
    stopPips: (STOP_ATR * atr) / pip,
    targetPips: (TARGET_ATR * atr) / pip,
    atr,
    carryPipsPerDay: (entry * (tradeCarry / 100)) / 365 / pip,
  };
}

// Leitura contrária nos extremos: comprar a moeda em que os especuladores estão
// vendidos (e vender a que estão comprados) é onde mora a assimetria — se a
// multidão desmontar, empurra o preço a seu favor. Os dois lados do par contam.
function cotVerdict(cot: Map<string, CotPosition>, buyCcy: string, sellCcy: string): CotNote | null {
  const buyIndex = cot.get(buyCcy)?.cotIndex;
  const sellIndex = cot.get(sellCcy)?.cotIndex;
  const sides: number[] = [];
  if (buyIndex !== undefined) sides.push(50 - buyIndex);
  if (sellIndex !== undefined) sides.push(sellIndex - 50);
  if (sides.length === 0) return null;
  const score = sides.reduce((s, v) => s + v, 0) / sides.length;
  return { buyCcy, sellCcy, buyIndex, sellIndex, score, verdict: score >= 20 ? "espaco" : score <= -20 ? "lotado" : "neutro" };
}

// Quantas ideias fortes compram (+) ou vendem (−) cada moeda — 4 pares vendendo
// CHF são, na prática, uma aposta só.
export function currencyExposure(ideas: ForexIdea[]): Record<string, number> {
  const exposure: Record<string, number> = {};
  for (const idea of ideas) {
    if (idea.isHedge || idea.conviction !== "forte" || !idea.levels) continue;
    const [base, quote] = idea.pair.split("/");
    const sign = idea.levels.side === "alta" ? 1 : -1;
    exposure[base] = (exposure[base] ?? 0) + sign;
    exposure[quote] = (exposure[quote] ?? 0) - sign;
  }
  return exposure;
}

const DOWNGRADE: Record<Conviction, Conviction> = { forte: "medio", medio: "fraco", fraco: "fraco" };

function sharedCurrency(pairA: string, pairB: string): boolean {
  const [a1, a2] = pairA.split("/");
  const [b1, b2] = pairB.split("/");
  return a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2;
}

function signed(n: number, digits = 2): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
}

interface Candidate {
  pair: string;
  symbol: string;
  base: string;
  quote: string;
  direction: Direction;
  kind: IdeaKind;
  dayPct: number;
  weekPct: number;
  score: number;
  conviction: Conviction;
  carryPp?: number;
  levels: TradeLevels | null;
  cot: CotNote | null;
}

export async function getForexIdeas(): Promise<ForexIdeasResult> {
  const [quotes, barsList, rates, cotList] = await Promise.all([
    Promise.all(ANALYSIS_PAIRS.map((p) => fetchQuote(p.symbol))),
    Promise.all(ANALYSIS_PAIRS.map((p) => fetchDailyBars(p.symbol))),
    getPolicyRates(),
    getCotPositions().catch(() => [] as CotPosition[]),
  ]);

  const rateMap = ratesToMap(rates);
  const cotMap = new Map(cotList.map((c) => [c.currency, c]));
  const prices: Record<string, number> = {};
  const candidates: Candidate[] = [];

  ANALYSIS_PAIRS.forEach((p, i) => {
    const quote = quotes[i];
    const bars = barsList[i];
    if (!quote) return;
    prices[p.pair] = quote.price;

    const day = quote.changePct;
    const week = weekChangePct(bars);
    if (week === null) return;
    if (!((day > 0 && week > 0) || (day < 0 && week < 0))) return; // só sinal consistente nos dois tempos

    const direction: Direction = day > 0 ? "alta" : "queda";
    const absDay = Math.abs(day);
    const absWeek = Math.abs(week);

    const cp = rateMap[p.base] !== undefined && rateMap[p.quote] !== undefined ? rateMap[p.base] - rateMap[p.quote] : undefined;
    const carryAligned = cp !== undefined && ((direction === "alta" && cp > 0) || (direction === "queda" && cp < 0));
    // Preço andando forte CONTRA um carry relevante: possível desconto exagerado.
    const isDistortion = cp !== undefined && Math.abs(cp) >= 2 && !carryAligned && absWeek >= 1.5;
    const kind: IdeaKind = isDistortion ? "distorcao" : carryAligned ? "carry" : "neutro";

    const side: Direction = isDistortion ? (direction === "alta" ? "queda" : "alta") : direction;
    const [buyCcy, sellCcy] = side === "alta" ? [p.base, p.quote] : [p.quote, p.base];
    const cot = cotVerdict(cotMap, buyCcy, sellCcy);

    let score = absDay + absWeek * 0.6;
    if (carryAligned) score += Math.abs(cp!) * 0.2;
    if (isDistortion) score += Math.abs(cp!) * 0.1;
    if (cot?.verdict === "espaco") score += 0.5;
    if (cot?.verdict === "lotado") score -= 1;

    let conviction: Conviction = absDay >= 0.3 && absWeek >= 1 ? "forte" : absDay >= 0.15 || absWeek >= 0.5 ? "medio" : "fraco";
    if (conviction === "medio" && carryAligned && (Math.abs(cp!) >= 3 || cot?.verdict === "espaco")) conviction = "forte";
    if (cot?.verdict === "lotado") conviction = DOWNGRADE[conviction];

    const atr = computeAtr(bars);
    const levels = atr ? buildLevels(p.pair, side, quote.price, atr, cp) : null;

    candidates.push({ pair: p.pair, symbol: p.symbol, base: p.base, quote: p.quote, direction, kind, dayPct: day, weekPct: week, score, conviction, carryPp: cp, levels, cot });
  });

  const order: Record<Conviction, number> = { forte: 0, medio: 1, fraco: 2 };
  candidates.sort((a, b) => order[a.conviction] - order[b.conviction] || b.score - a.score);

  const top = [
    ...candidates.filter((c) => c.kind === "carry").slice(0, 5),
    ...candidates.filter((c) => c.kind === "neutro").slice(0, 3),
    ...candidates.filter((c) => c.kind === "distorcao").slice(0, 2),
  ];
  const forteCarry = top.filter((c) => c.conviction === "forte" && c.kind === "carry");

  const hedges: { candidate: Candidate; hedgeFor: string }[] = [];
  for (const idea of forteCarry.slice(0, 3)) {
    const hedge = candidates.find(
      (c) =>
        c.kind !== "distorcao" &&
        !sharedCurrency(idea.pair, c.pair) &&
        !top.some((t) => t.pair === c.pair) &&
        !hedges.some((h) => h.candidate.pair === c.pair)
    );
    if (hedge) hedges.push({ candidate: hedge, hedgeFor: idea.pair });
  }

  const buildIdea = (c: Candidate, hedgeFor?: string): ForexIdea => {
    const sideLabel = c.levels?.side === "queda" ? "venda" : "compra";
    let label: string;
    let rationale: string;

    if (hedgeFor) {
      label = `Hedge sugerido: ${c.pair} (${c.direction})`;
      rationale = `Não compartilha moeda com "${hedgeFor}" — diversifica a exposição sem concentrar tudo numa moeda só.`;
    } else if (c.kind === "distorcao") {
      label = `${c.pair}: distorção — preço ${c.direction === "alta" ? "subindo" : "caindo"} contra o carry`;
      rationale = `O lado do carry é ${sideLabel} (${Math.abs(c.carryPp!).toFixed(2)}pp a.a. a favor), mas o preço andou ${signed(c.weekPct)}% contra na semana — possível desconto exagerado. Níveis abaixo são pro lado do carry: só vale após sinal de reversão no 4h/diário.`;
    } else {
      const tradeCarry = c.carryPp === undefined ? undefined : (c.direction === "alta" ? 1 : -1) * c.carryPp;
      const carryNote =
        tradeCarry === undefined ? "" : tradeCarry > 0 ? ` Carry de +${tradeCarry.toFixed(2)}pp a.a. a favor.` : tradeCarry < 0 ? ` Carry de ${tradeCarry.toFixed(2)}pp a.a. contra (paga swap).` : "";
      label = `${c.pair}: ${c.direction} consistente (diário e semanal)`;
      rationale = `Variação diária ${signed(c.dayPct)}% e semanal ${signed(c.weekPct)}% na mesma direção — não é só ruído de um dia.${carryNote}`;
    }

    return {
      pair: c.pair,
      symbol: c.symbol,
      direction: c.direction,
      kind: c.kind,
      label,
      rationale,
      conviction: c.conviction,
      isHedge: Boolean(hedgeFor),
      hedgeFor,
      dayPct: c.dayPct,
      weekPct: c.weekPct,
      carryPp: c.carryPp,
      levels: c.levels,
      cot: c.cot,
    };
  };

  return {
    ideas: [...top.map((c) => buildIdea(c)), ...hedges.map((h) => buildIdea(h.candidate, h.hedgeFor))],
    prices,
    rates,
    cot: cotList,
    updatedAt: new Date().toISOString(),
  };
}
