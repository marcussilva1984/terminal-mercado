import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { upsertCloses, type PriceSeriesRow } from "@/lib/db/priceSeriesRepo";
import { getWatchlist, seedWatchlistIfEmpty } from "@/lib/db/watchlistRepo";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";
import { getYahooQuote } from "@/lib/sources/yahoo";
import { B3_WATCHLIST, CRIPTO_WATCHLIST, FII_WATCHLIST, STOCKS_WATCHLIST, FOREX_WATCHLIST } from "@/lib/watchlist";
import { getHoldings } from "@/lib/db/portfolioRepo";

// Benchmarks fixos pra correlação/beta da watchlist e da carteira contra o
// mercado — não fazem parte de nenhuma watchlist de usuário, coletados à
// parte sob assetClass "indice".
const BENCHMARKS = [
  { symbol: "IBOV", yahoo: "^BVSP" },
  { symbol: "SPX", yahoo: "^GSPC" },
  { symbol: "DXY", yahoo: "DX-Y.NYB" },
] as const;

async function fetchClass(
  items: { symbol: string; label: string }[],
  assetClass: string,
  toYahooSymbol: (symbol: string) => string
): Promise<PriceSeriesRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const settled = await Promise.allSettled(
    items.map(async ({ symbol }) => {
      const q = await getYahooQuote(toYahooSymbol(symbol));
      if (!q) return null;
      return { symbol, assetClass, date: today, closePrice: q.price, source: "yahoo" } satisfies PriceSeriesRow;
    })
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<PriceSeriesRow | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is PriceSeriesRow => v !== null);
}

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
    ...FOREX_WATCHLIST.map((w) => ({ ...w, assetClass: "forex" })),
  ]);

  const holdings = await getHoldings().catch(() => []);
  const holdingsByClass = (cls: string) =>
    holdings.filter((h) => h.assetClass === cls).map((h) => ({ symbol: h.symbol, label: h.label }));

  // Carteira entra na coleta mesmo se o ativo não estiver na watchlist —
  // drawdown/Sharpe da carteira precisam de histórico independente disso.
  const dedupe = (a: { symbol: string; label: string }[], b: { symbol: string; label: string }[]) => {
    const seen = new Set(a.map((x) => x.symbol));
    return [...a, ...b.filter((x) => !seen.has(x.symbol))];
  };

  const [dbB3, dbCripto, dbFii, dbStocks, dbForex] = await Promise.all([
    getWatchlist("b3"),
    getWatchlist("cripto"),
    getWatchlist("fii"),
    getWatchlist("stocks"),
    getWatchlist("forex"),
  ]);

  const b3Watchlist = dedupe(dbB3, holdingsByClass("b3"));
  const criptoWatchlist = dedupe(dbCripto, holdingsByClass("cripto"));
  const fiiWatchlist = dedupe(dbFii, holdingsByClass("fii"));
  const stocksWatchlist = dedupe(dbStocks, holdingsByClass("stocks"));
  const forexWatchlist = dedupe(dbForex, holdingsByClass("forex"));
  const today = new Date().toISOString().slice(0, 10);

  // Antes cada classe rodava um for...await sequencial, uma cotação de cada
  // vez — com a watchlist grande (100+ ativos somados) isso passava fácil de
  // 30-45s de chamadas encadeadas, estourando o timeout da função serverless
  // (plano Hobby da Vercel) bem antes de chegar nas últimas classes da fila
  // (FII e Stocks nunca eram alcançados). Promise.all roda as 5 classes em
  // paralelo, e dentro de cada uma todas as cotações também em paralelo —
  // o total cai pra ~1-2s em vez de dezenas de segundos.
  const criptoPromise = (async () => {
    try {
      const markets = await getTopCoinMarkets(250);
      const rows: PriceSeriesRow[] = [];
      for (const { symbol } of criptoWatchlist) {
        const coin = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
        if (coin) rows.push({ symbol, assetClass: "cripto", date: today, closePrice: coin.current_price, source: "coingecko" });
      }
      return rows;
    } catch {
      return [];
    }
  })();

  const [b3Rows, fiiRows, stocksRows, forexRows, benchmarkRows, criptoRows] = await Promise.all([
    fetchClass(b3Watchlist, "b3", (s) => `${s}.SA`),
    fetchClass(fiiWatchlist, "fii", (s) => `${s}.SA`),
    fetchClass(stocksWatchlist, "stocks", (s) => s),
    fetchClass(forexWatchlist, "forex", (s) => `${s}=X`),
    fetchClass(
      BENCHMARKS.map((b) => ({ symbol: b.symbol, label: b.symbol })),
      "indice",
      (s) => BENCHMARKS.find((b) => b.symbol === s)!.yahoo
    ),
    criptoPromise,
  ]);

  const rows = [...b3Rows, ...criptoRows, ...fiiRows, ...stocksRows, ...forexRows, ...benchmarkRows];

  await upsertCloses(rows);

  return NextResponse.json({
    persisted: true,
    rows: rows.length,
    byClass: {
      b3: b3Rows.length,
      cripto: criptoRows.length,
      fii: fiiRows.length,
      stocks: stocksRows.length,
      forex: forexRows.length,
      indice: benchmarkRows.length,
    },
  });
}
