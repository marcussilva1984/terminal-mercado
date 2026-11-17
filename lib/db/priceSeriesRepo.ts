import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { priceSeries } from "@/lib/db/schema";

export interface ClosePoint {
  date: string;
  closePrice: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
}

export async function getCloses(symbol: string, assetClass: string, limit = 60): Promise<ClosePoint[]> {
  const db = getDb();
  // Pega os N mais recentes (desc + limit) e reordena pra ascendente antes de
  // devolver — pegar direto em asc + limit cortava nos N mais ANTIGOS assim
  // que o histórico acumulado passava de N linhas, deixando o z-score cego
  // pro preço de hoje.
  const rows = await db
    .select({
      date: priceSeries.date,
      closePrice: priceSeries.closePrice,
      highPrice: priceSeries.highPrice,
      lowPrice: priceSeries.lowPrice,
      volume: priceSeries.volume,
    })
    .from(priceSeries)
    .where(and(eq(priceSeries.symbol, symbol), eq(priceSeries.assetClass, assetClass)))
    .orderBy(desc(priceSeries.date))
    .limit(limit);

  return rows.reverse().map((r) => ({
    date: r.date,
    closePrice: r.closePrice,
    highPrice: r.highPrice ?? undefined,
    lowPrice: r.lowPrice ?? undefined,
    volume: r.volume ?? undefined,
  }));
}

// Uma query pra classe inteira em vez de uma por símbolo — usado pelo
// ranking multi-período, que antes rodava getCloses() pra cada ativo da
// watchlist (30+ round-trips separados ao banco por carga de página, medido
// em produção deixando FII em ~20s). Agrupa por símbolo em memória.
export async function getClosesForClass(assetClass: string, sinceDays = 31): Promise<Map<string, ClosePoint[]>> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - sinceDays);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      symbol: priceSeries.symbol,
      date: priceSeries.date,
      closePrice: priceSeries.closePrice,
      highPrice: priceSeries.highPrice,
      lowPrice: priceSeries.lowPrice,
      volume: priceSeries.volume,
    })
    .from(priceSeries)
    .where(and(eq(priceSeries.assetClass, assetClass), gte(priceSeries.date, cutoffISO)))
    .orderBy(asc(priceSeries.date));

  const bySymbol = new Map<string, ClosePoint[]>();
  for (const r of rows) {
    if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, []);
    bySymbol.get(r.symbol)!.push({ date: r.date, closePrice: r.closePrice, highPrice: r.highPrice ?? undefined, lowPrice: r.lowPrice ?? undefined, volume: r.volume ?? undefined } as ClosePoint);
  }
  return bySymbol;
}

export interface PriceSeriesRow {
  symbol: string;
  assetClass: string;
  date: string;
  closePrice: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  source: string;
}

export async function upsertCloses(rows: PriceSeriesRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  await db
    .insert(priceSeries)
    .values(rows)
    .onConflictDoUpdate({
      target: [priceSeries.symbol, priceSeries.assetClass, priceSeries.date],
      set: {
        closePrice: sql`excluded.close_price`,
        highPrice: sql`COALESCE(excluded.high_price, price_series.high_price)`,
        lowPrice: sql`COALESCE(excluded.low_price, price_series.low_price)`,
        volume: sql`COALESCE(excluded.volume, price_series.volume)`,
      },
    });
}
