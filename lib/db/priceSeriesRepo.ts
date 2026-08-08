import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { priceSeries } from "@/lib/db/schema";

export interface ClosePoint {
  date: string;
  closePrice: number;
}

export async function getCloses(symbol: string, assetClass: string, limit = 60): Promise<ClosePoint[]> {
  const db = getDb();
  // Pega os N mais recentes (desc + limit) e reordena pra ascendente antes de
  // devolver — pegar direto em asc + limit cortava nos N mais ANTIGOS assim
  // que o histórico acumulado passava de N linhas, deixando o z-score cego
  // pro preço de hoje.
  const rows = await db
    .select({ date: priceSeries.date, closePrice: priceSeries.closePrice })
    .from(priceSeries)
    .where(and(eq(priceSeries.symbol, symbol), eq(priceSeries.assetClass, assetClass)))
    .orderBy(desc(priceSeries.date))
    .limit(limit);

  return rows.reverse();
}

export interface PriceSeriesRow {
  symbol: string;
  assetClass: string;
  date: string;
  closePrice: number;
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
      set: { closePrice: sql`excluded.close_price` },
    });
}
