import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { watchlistItems } from "@/lib/db/schema";

export interface WatchlistItemInput {
  symbol: string;
  assetClass: string; // 'b3' | 'cripto'
  label: string;
}

export async function getWatchlist(assetClass?: string) {
  const db = getDb();
  const rows = assetClass
    ? await db
        .select()
        .from(watchlistItems)
        .where(and(eq(watchlistItems.active, "true"), eq(watchlistItems.assetClass, assetClass)))
    : await db.select().from(watchlistItems).where(eq(watchlistItems.active, "true"));
  return rows.sort((a, b) => a.id - b.id);
}

export async function addWatchlistItem(input: WatchlistItemInput) {
  const db = getDb();
  await db.insert(watchlistItems).values(input);
}

export async function removeWatchlistItem(id: number) {
  const db = getDb();
  await db.update(watchlistItems).set({ active: "false" }).where(eq(watchlistItems.id, id));
}

export async function seedWatchlistIfEmpty(defaults: (WatchlistItemInput & { assetClass: string })[]) {
  const db = getDb();
  const existing = await db.select({ id: watchlistItems.id }).from(watchlistItems).limit(1);
  if (existing.length > 0) return;
  await db.insert(watchlistItems).values(defaults);
}
