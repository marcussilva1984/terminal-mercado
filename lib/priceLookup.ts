import { getYahooQuote } from "@/lib/sources/yahoo";
import { getTopCoinMarkets, getCoinMarketBySymbolFallback } from "@/lib/sources/coingecko";

export interface CurrentPrice {
  price: number;
  changePct: number;
  currency: string;
}

// Ponto único de "qual é o preço agora" para um símbolo, dado a classe de ativo —
// usado pela carteira (P&L) e pelos alertas de preço (cron).
export async function getCurrentPrice(symbol: string, assetClass: string): Promise<CurrentPrice | null> {
  if (assetClass === "b3" || assetClass === "fii") {
    const q = await getYahooQuote(`${symbol}.SA`);
    return q ? { price: q.price, changePct: q.changePct, currency: "BRL" } : null;
  }

  if (assetClass === "stocks") {
    const q = await getYahooQuote(symbol);
    return q ? { price: q.price, changePct: q.changePct, currency: "USD" } : null;
  }

  if (assetClass === "cripto") {
    const markets = await getTopCoinMarkets(250);
    const coin = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
    if (coin) {
      return { price: coin.current_price, changePct: coin.price_change_percentage_24h ?? 0, currency: "USD" };
    }
    // Moeda fora do top-250 por market cap (usuário pode adicionar qualquer
    // símbolo na watchlist manualmente) — tenta achar via busca por símbolo.
    const fallback = await getCoinMarketBySymbolFallback(symbol).catch(() => null);
    return fallback
      ? { price: fallback.current_price, changePct: fallback.price_change_percentage_24h ?? 0, currency: "USD" }
      : null;
  }

  if (assetClass === "forex") {
    const q = await getYahooQuote(`${symbol}=X`);
    return q ? { price: q.price, changePct: q.changePct, currency: "USD" } : null;
  }

  return null;
}
