import type { Quote } from "@/lib/types";
import { getYahooQuotes } from "@/lib/sources/yahoo";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";

const YAHOO_TICKER_SYMBOLS = {
  IBOV: { yahoo: "^BVSP", label: "Ibovespa", currency: "BRL", assetClass: "indice" as const },
  USDBRL: { yahoo: "BRL=X", label: "USD/BRL", currency: "BRL", assetClass: "forex" as const },
  SPX: { yahoo: "^GSPC", label: "S&P 500", currency: "USD", assetClass: "indice" as const },
  PETR4: { yahoo: "PETR4.SA", label: "Petrobras PN", currency: "BRL", assetClass: "b3" as const },
  VALE3: { yahoo: "VALE3.SA", label: "Vale ON", currency: "BRL", assetClass: "b3" as const },
};

const CRIPTO_TICKER_SYMBOLS = ["BTC", "ETH", "SOL"];

// Cotações reais para o ticker tape e para a Home. Ativos cuja fonte falha são
// simplesmente omitidos — nunca mostramos um valor de exemplo como se fosse real.
export async function getRealTickerQuotes(): Promise<Quote[]> {
  const now = new Date().toISOString();
  const yahooSymbols = Object.values(YAHOO_TICKER_SYMBOLS).map((s) => s.yahoo);

  const [yahooResults, coinMarkets] = await Promise.all([
    getYahooQuotes(yahooSymbols),
    getTopCoinMarkets(250).catch(() => []),
  ]);

  const quotes: Quote[] = [];

  for (const [symbol, cfg] of Object.entries(YAHOO_TICKER_SYMBOLS)) {
    const q = yahooResults[cfg.yahoo];
    if (!q) continue;
    quotes.push({
      symbol,
      label: cfg.label,
      price: q.price,
      changePct: q.changePct,
      assetClass: cfg.assetClass,
      currency: cfg.currency,
      updatedAt: now,
    });
  }

  for (const symbol of CRIPTO_TICKER_SYMBOLS) {
    const coin = coinMarkets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
    if (!coin) continue;
    quotes.push({
      symbol,
      label: coin.name,
      price: coin.current_price,
      changePct: coin.price_change_percentage_24h ?? 0,
      assetClass: "cripto",
      currency: "USD",
      updatedAt: now,
    });
  }

  return quotes;
}

export interface HighlightCard {
  label: string;
  value: string;
  changePct: number;
}

const HIGHLIGHT_SYMBOLS = {
  dxy: "DX-Y.NYB",
  spFut: "ES=F",
  wti: "CL=F",
};

export async function getRealHighlightCards(): Promise<HighlightCard[]> {
  const results = await getYahooQuotes(Object.values(HIGHLIGHT_SYMBOLS));
  const cards: HighlightCard[] = [];

  const dxy = results[HIGHLIGHT_SYMBOLS.dxy];
  if (dxy) cards.push({ label: "Índice Dólar (DXY)", value: dxy.price.toFixed(2), changePct: dxy.changePct });

  const spFut = results[HIGHLIGHT_SYMBOLS.spFut];
  if (spFut) cards.push({ label: "S&P Fut.", value: spFut.price.toFixed(1), changePct: spFut.changePct });

  const wti = results[HIGHLIGHT_SYMBOLS.wti];
  if (wti) cards.push({ label: "WTI", value: `US$ ${wti.price.toFixed(2)}`, changePct: wti.changePct });

  return cards;
}
