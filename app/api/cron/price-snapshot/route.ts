import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { upsertCloses, type PriceSeriesRow } from "@/lib/db/priceSeriesRepo";
import { getWatchlist, seedWatchlistIfEmpty } from "@/lib/db/watchlistRepo";
import { getBrapiLastClose } from "@/lib/sources/brapi";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";
import { B3_WATCHLIST, CRIPTO_WATCHLIST } from "@/lib/watchlist";

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
  ]);

  const rows: PriceSeriesRow[] = [];
  const b3Watchlist = await getWatchlist("b3");
  const criptoWatchlist = await getWatchlist("cripto");

  for (const { symbol } of b3Watchlist) {
    try {
      const point = await getBrapiLastClose(symbol);
      if (point) {
        rows.push({ symbol, assetClass: "b3", date: point.date, closePrice: point.close, source: "brapi.dev" });
      }
    } catch {
      // fonte indisponível para este ativo — segue para os demais
    }
  }

  try {
    const markets = await getTopCoinMarkets(250);
    const today = new Date().toISOString().slice(0, 10);
    for (const { symbol } of criptoWatchlist) {
      const coin = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
      if (coin) {
        rows.push({ symbol, assetClass: "cripto", date: today, closePrice: coin.current_price, source: "coingecko" });
      }
    }
  } catch {
    // CoinGecko indisponível — segue apenas com o que já foi coletado da B3
  }

  await upsertCloses(rows);

  return NextResponse.json({ persisted: true, rows: rows.length });
}
