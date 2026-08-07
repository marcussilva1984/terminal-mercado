import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { upsertCloses, type PriceSeriesRow } from "@/lib/db/priceSeriesRepo";
import { getWatchlist, seedWatchlistIfEmpty } from "@/lib/db/watchlistRepo";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";
import { getYahooQuote } from "@/lib/sources/yahoo";
import { B3_WATCHLIST, CRIPTO_WATCHLIST, FII_WATCHLIST, STOCKS_WATCHLIST } from "@/lib/watchlist";
import { getHoldings } from "@/lib/db/portfolioRepo";

// Benchmarks fixos pra correlação/beta da watchlist e da carteira contra o
// mercado — não fazem parte de nenhuma watchlist de usuário, coletados à
// parte sob assetClass "indice".
const BENCHMARKS = [
  { symbol: "IBOV", yahoo: "^BVSP" },
  { symbol: "SPX", yahoo: "^GSPC" },
  { symbol: "DXY", yahoo: "DX-Y.NYB" },
] as const;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json({ persisted: false, reason: "DATABASE_URL não configurada" });
  }

  await seedWatchlistIfEmpty([
    ...B3_WATCHLIST.map((w) => ({ ...w, assetClass: "b3" })),
    ...CRIPTO_WATCHLIST.map((w) => ({ ...w, assetClass: "cripto" })),
    ...FII_WATCHLIST.map((w) => ({ ...w, assetClass: "fii" })),
    ...STOCKS_WATCHLIST.map((w) => ({ ...w, assetClass: "stocks" })),
  ]);

  const rows: PriceSeriesRow[] = [];
  const holdings = await getHoldings().catch(() => []);
  const holdingsByClass = (cls: string) =>
    holdings.filter((h) => h.assetClass === cls).map((h) => ({ symbol: h.symbol, label: h.label }));

  // Carteira entra na coleta mesmo se o ativo não estiver na watchlist —
  // drawdown/Sharpe da carteira precisam de histórico independente disso.
  const dedupe = (a: { symbol: string; label: string }[], b: { symbol: string; label: string }[]) => {
    const seen = new Set(a.map((x) => x.symbol));
    return [...a, ...b.filter((x) => !seen.has(x.symbol))];
  };

  const b3Watchlist = dedupe(await getWatchlist("b3"), holdingsByClass("b3"));
  const criptoWatchlist = dedupe(await getWatchlist("cripto"), holdingsByClass("cripto"));
  const fiiWatchlist = dedupe(await getWatchlist("fii"), holdingsByClass("fii"));
  const stocksWatchlist = dedupe(await getWatchlist("stocks"), holdingsByClass("stocks"));
  const today = new Date().toISOString().slice(0, 10);

  // Yahoo (não brapi) pra B3 aqui de propósito: sem BRAPI_TOKEN, a brapi.dev só
  // libera histórico pra 4 tickers fixos, o que travava o z-score em qualquer
  // papel novo adicionado na watchlist. Yahoo não tem esse limite.
  for (const { symbol } of b3Watchlist) {
    try {
      const q = await getYahooQuote(`${symbol}.SA`);
      if (q) rows.push({ symbol, assetClass: "b3", date: today, closePrice: q.price, source: "yahoo" });
    } catch {
      // fonte indisponível para este ativo — segue para os demais
    }
  }

  try {
    const markets = await getTopCoinMarkets(250);
    for (const { symbol } of criptoWatchlist) {
      const coin = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
      if (coin) {
        rows.push({ symbol, assetClass: "cripto", date: today, closePrice: coin.current_price, source: "coingecko" });
      }
    }
  } catch {
    // CoinGecko indisponível — segue apenas com o que já foi coletado
  }

  // FII e Stocks não têm um provedor gratuito com histórico batch como o
  // brapi/CoinGecko — usa cotação atual via Yahoo (mesma fonte já usada em
  // toda a página de detalhe) como fechamento do dia, ativo por ativo.
  for (const { symbol } of fiiWatchlist) {
    try {
      const q = await getYahooQuote(`${symbol}.SA`);
      if (q) rows.push({ symbol, assetClass: "fii", date: today, closePrice: q.price, source: "yahoo" });
    } catch {
      // fonte indisponível para este ativo — segue para os demais
    }
  }

  for (const { symbol } of stocksWatchlist) {
    try {
      const q = await getYahooQuote(symbol);
      if (q) rows.push({ symbol, assetClass: "stocks", date: today, closePrice: q.price, source: "yahoo" });
    } catch {
      // fonte indisponível para este ativo — segue para os demais
    }
  }

  for (const b of BENCHMARKS) {
    try {
      const q = await getYahooQuote(b.yahoo);
      if (q) rows.push({ symbol: b.symbol, assetClass: "indice", date: today, closePrice: q.price, source: "yahoo" });
    } catch {
      // fonte indisponível pra esse benchmark — segue pros demais
    }
  }

  await upsertCloses(rows);

  return NextResponse.json({ persisted: true, rows: rows.length });
}
