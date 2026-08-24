import { unstable_cache } from "next/cache";
import type { Quote } from "@/lib/types";
import { getYahooQuotes } from "@/lib/sources/yahoo";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";
import { getCurrentPrice } from "@/lib/priceLookup";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";

const YAHOO_TICKER_SYMBOLS = {
  IBOV: { yahoo: "^BVSP", label: "Ibovespa", currency: "BRL", assetClass: "indice" as const },
  USDBRL: { yahoo: "BRL=X", label: "USD/BRL", currency: "BRL", assetClass: "forex" as const },
  SPX: { yahoo: "^GSPC", label: "S&P 500", currency: "USD", assetClass: "indice" as const },
  PETR4: { yahoo: "PETR4.SA", label: "Petrobras PN", currency: "BRL", assetClass: "b3" as const },
  VALE3: { yahoo: "VALE3.SA", label: "Vale ON", currency: "BRL", assetClass: "b3" as const },
  VIX: { yahoo: "^VIX", label: "VIX", currency: "USD", assetClass: "indice" as const },
  DXY: { yahoo: "DX-Y.NYB", label: "Índice Dólar (DXY)", currency: "USD", assetClass: "indice" as const },
  EURUSD: { yahoo: "EURUSD=X", label: "EUR/USD", currency: "USD", assetClass: "forex" as const },
  GBPUSD: { yahoo: "GBPUSD=X", label: "GBP/USD", currency: "USD", assetClass: "forex" as const },
  BRENT: { yahoo: "BZ=F", label: "Brent", currency: "USD", assetClass: "indice" as const },
  AUDNZD: { yahoo: "AUDNZD=X", label: "AUD/NZD", currency: "USD", assetClass: "forex" as const },
  NZDUSD: { yahoo: "NZDUSD=X", label: "NZD/USD", currency: "USD", assetClass: "forex" as const },
  GBPAUD: { yahoo: "GBPAUD=X", label: "GBP/AUD", currency: "USD", assetClass: "forex" as const },
  GBPNZD: { yahoo: "GBPNZD=X", label: "GBP/NZD", currency: "USD", assetClass: "forex" as const },
  EURAUD: { yahoo: "EURAUD=X", label: "EUR/AUD", currency: "USD", assetClass: "forex" as const },
  EURNZD: { yahoo: "EURNZD=X", label: "EUR/NZD", currency: "USD", assetClass: "forex" as const },
  EURCHF: { yahoo: "EURCHF=X", label: "EUR/CHF", currency: "USD", assetClass: "forex" as const },
  GBPCHF: { yahoo: "GBPCHF=X", label: "GBP/CHF", currency: "USD", assetClass: "forex" as const },
  USDJPY: { yahoo: "USDJPY=X", label: "USD/JPY", currency: "USD", assetClass: "forex" as const },
  EURJPY: { yahoo: "EURJPY=X", label: "EUR/JPY", currency: "USD", assetClass: "forex" as const },
};

const CRIPTO_TICKER_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "HYPE", "XRP", "SUI", "BP", "LINK"];

// Ordem pedida: cripto, forex, ação (B3), FII, e por último stocks (não
// mencionado, mas não faz sentido descartar do ticker).
const WATCHLIST_CLASS_ORDER = ["cripto", "forex", "b3", "fii", "stocks"];

// Buscar TODA a watchlist (100+ itens em alguns casos) toda vez que o cache
// expira deixava a troca de aba lenta — isso roda no layout raiz, ou seja,
// em toda página. Limita por classe (não no total) pra continuar
// representando as 5 categorias pedidas, só que sem estourar o tempo de
// resposta quando o cache precisa recalcular.
const MAX_PER_CLASS_IN_TICKER = 12;

async function computeRealTickerQuotes(): Promise<Quote[]> {
  const now = new Date().toISOString();
  const yahooSymbols = Object.values(YAHOO_TICKER_SYMBOLS).map((s) => s.yahoo);

  const [yahooResults, coinMarkets, watchlist] = await Promise.all([
    getYahooQuotes(yahooSymbols),
    getTopCoinMarkets(250).catch(() => []),
    hasDatabase() ? getWatchlist().catch(() => []) : Promise.resolve([]),
  ]);

  const quotes: Quote[] = [];
  const seen = new Set<string>();

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
    seen.add(symbol);
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
    seen.add(symbol);
  }

  // Ordena pela classe pedida antes de buscar cotação — Promise.allSettled
  // preserva a ordem do array de entrada na saída, então isso já garante a
  // ordem final de exibição sem precisar reordenar depois.
  const countByClass = new Map<string, number>();
  const watchlistToFetch = watchlist
    .filter((w) => !seen.has(w.symbol))
    .filter((w) => {
      const count = countByClass.get(w.assetClass) ?? 0;
      if (count >= MAX_PER_CLASS_IN_TICKER) return false;
      countByClass.set(w.assetClass, count + 1);
      return true;
    })
    .sort((a, b) => WATCHLIST_CLASS_ORDER.indexOf(a.assetClass) - WATCHLIST_CLASS_ORDER.indexOf(b.assetClass));
  const watchlistResults = await Promise.allSettled(
    watchlistToFetch.map(async (w) => ({ w, price: await getCurrentPrice(w.symbol, w.assetClass) }))
  );
  for (const r of watchlistResults) {
    if (r.status !== "fulfilled" || !r.value.price) continue;
    const { w, price } = r.value;
    quotes.push({
      symbol: w.symbol,
      label: w.label,
      price: price.price,
      changePct: price.changePct,
      assetClass: w.assetClass as Quote["assetClass"],
      currency: price.currency,
      updatedAt: now,
    });
  }

  return quotes;
}

// Cotações reais para o ticker tape e para a Home. Ativos cuja fonte falha são
// simplesmente omitidos — nunca mostramos um valor de exemplo como se fosse
// real. Cacheado porque o layout raiz chama isso em toda navegação — sem
// cache, cada troca de página refazia todas essas cotações do zero. Janela
// de 5min (não 60s) porque isso busca dezenas de ativos de fontes externas
// diferentes — recalcular com frequência alta é exatamente o que deixava a
// troca de aba lenta sempre que o cache vencia.
export const getRealTickerQuotes = unstable_cache(computeRealTickerQuotes, ["real-ticker-quotes"], {
  revalidate: 5 * 60,
});

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
