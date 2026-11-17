import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";
export interface YahooQuote {
  symbol: string;
  price: number;
  changePct: number;
  currency: string;
  marketDate: string | null; // YYYY-MM-DD do pregão da cotação, no fuso da bolsa
  high?: number;
  low?: number;
  volume?: number;
}

// Data do pregão no fuso da bolsa. Pra timestamp de candle diário, passe
// isCandle: o candle de forex começa à meia-noite de Londres (23:00 UTC no
// verão) e o deslocamento de 6h evita cair no dia anterior.
export function yahooTradingDate(unixSeconds: number, gmtOffsetSeconds: number, isCandle = false): string {
  const shift = isCandle ? 6 * 3600 : 0;
  return new Date((unixSeconds + gmtOffsetSeconds + shift) * 1000).toISOString().slice(0, 10);
}

// API não-oficial do Yahoo Finance: sem chave, sem token, cobre índices (^GSPC, ^BVSP,
// ^IXIC, ^DJI, ^RUT, ^VIX), moedas (BRL=X, EURUSD=X...), commodities (CL=F, GC=F),
// DXY (DX-Y.NYB) e ações de qualquer bolsa (NVDA, PETR4.SA...). Validado manualmente
// antes de usar — ver notas no README.
export async function getYahooQuote(symbol: string, revalidateSeconds = 300): Promise<YahooQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;

  const res = await fetch(url, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;

  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  const marketDate =
    typeof meta.regularMarketTime === "number" ? yahooTradingDate(meta.regularMarketTime, meta.gmtoffset ?? 0) : null;

  return {
    symbol,
    price,
    changePct,
    currency: meta.currency ?? "USD",
    marketDate,
    high: typeof meta.regularMarketDayHigh === "number" ? meta.regularMarketDayHigh : undefined,
    low: typeof meta.regularMarketDayLow === "number" ? meta.regularMarketDayLow : undefined,
    volume: typeof meta.regularMarketVolume === "number" ? meta.regularMarketVolume : undefined,
  };
}

export async function getYahooQuotes(symbols: string[], revalidateSeconds = 300): Promise<Record<string, YahooQuote>> {
  const results = await Promise.allSettled(symbols.map((s) => getYahooQuote(s, revalidateSeconds)));
  const map: Record<string, YahooQuote> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) map[symbols[i]] = r.value;
  });
  return map;
}

export interface YahooScreenerItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
}

export type YahooScreenerId = "day_gainers" | "day_losers" | "most_actives";

// Screeners pré-definidos do Yahoo (mercado dos EUA inteiro, não só uma watchlist).
// Mesma API não-oficial acima — sem chave.
export async function getYahooScreener(scrId: YahooScreenerId, count = 25): Promise<YahooScreenerItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?lang=en-US&region=US&scrIds=${scrId}&count=${count}`;

  const res = await fetch(url, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    next: { revalidate: 5 * 60 },
  });

  if (!res.ok) throw new Error(`Yahoo screener respondeu ${res.status}`);

  const json = await res.json();
  const quotes: {
    symbol: string;
    longName?: string;
    shortName?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
    regularMarketVolume?: number;
  }[] = json?.finance?.result?.[0]?.quotes ?? [];

  return quotes
    .filter((q) => typeof q.regularMarketPrice === "number")
    .map((q) => ({
      symbol: q.symbol,
      name: q.longName ?? q.shortName ?? q.symbol,
      price: q.regularMarketPrice!,
      changePct: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
    }));
}
