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

// Semeia só as CLASSES que ainda não têm nenhuma linha — antes checava se a
// tabela inteira estava vazia, então uma classe nova (Forex, por ex.) nunca
// era inserida depois que a tabela já tinha dado de outras classes (o que
// aconteceu na prática: watchlist_items com 100+ linhas de b3/fii/stocks/
// cripto, e Forex ficou com ZERO linhas desde que foi adicionado ao código,
// mesmo chamando seedWatchlistIfEmpty com FOREX_WATCHLIST em vários lugares).
export async function seedWatchlistIfEmpty(defaults: (WatchlistItemInput & { assetClass: string })[]) {
  const db = getDb();
  const classesToSeed = [...new Set(defaults.map((d) => d.assetClass))];

  const existingClasses = await Promise.all(
    classesToSeed.map(async (cls) => {
      const rows = await db.select({ id: watchlistItems.id }).from(watchlistItems).where(eq(watchlistItems.assetClass, cls)).limit(1);
      return { cls, hasRows: rows.length > 0 };
    })
  );
  const emptyClasses = new Set(existingClasses.filter((c) => !c.hasRows).map((c) => c.cls));
  if (emptyClasses.size === 0) return;

  const toInsert = defaults.filter((d) => emptyClasses.has(d.assetClass));
  // onConflictDoNothing torna a inserção idempotente mesmo se duas requisições
  // concorrentes passarem pelo check "vazio" ao mesmo tempo (foi exatamente
  // isso que duplicou o Forex 6-8x em produção antes da constraint única
  // existir) — agora a unique key (symbol, asset_class) garante no máximo 1
  // linha por par, não importa quantas chamadas concorrentes cheguem aqui.
  if (toInsert.length > 0) {
    await db.insert(watchlistItems).values(toInsert).onConflictDoNothing({
      target: [watchlistItems.symbol, watchlistItems.assetClass],
    });
  }
}
