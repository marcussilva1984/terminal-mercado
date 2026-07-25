import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { priceSeries } from "@/lib/db/schema";

export interface ClosePoint {
  date: string;
  closePrice: number;
}

export async function getCloses(symbol: string, assetClass: string, limit = 60): Promise<ClosePoint[]> {
  const db = getDb();
  const rows = await db
    .select({ date: priceSeries.date, closePrice: priceSeries.closePrice })
    .from(priceSeries)
    .where(and(eq(priceSeries.symbol, symbol), eq(priceSeries.assetClass, assetClass)))
    .orderBy(asc(priceSeries.date))
    .limit(limit);

  return rows;
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
