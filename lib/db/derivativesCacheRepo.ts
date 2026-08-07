import { desc, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { derivativesCache } from "@/lib/db/schema";
import type { DerivativeSnapshot } from "@/lib/sources/binanceFutures";

export interface DerivativesCacheEntry {
  data: DerivativeSnapshot[];
  updatedAt: string;
}

export async function getDerivativesCache(): Promise<DerivativesCacheEntry | null> {
  const db = getDb();
  const rows = await db.select().from(derivativesCache).orderBy(desc(derivativesCache.updatedAt)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return { data: row.data as DerivativeSnapshot[], updatedAt: row.updatedAt.toISOString() };
}

// Só mantém a última leitura — não precisa de histórico aqui, é cache, não série.
export async function setDerivativesCache(data: DerivativeSnapshot[]): Promise<void> {
  const db = getDb();
  await db.insert(derivativesCache).values({ data });
  // Limpa entradas antigas pra não acumular linha infinita (roda a cada 15min).
  const rows = await db.select({ id: derivativesCache.id }).from(derivativesCache).orderBy(desc(derivativesCache.updatedAt));
  const staleIds = rows.slice(5).map((r) => r.id);
  if (staleIds.length > 0) {
    await db.delete(derivativesCache).where(inArray(derivativesCache.id, staleIds));
  }
}
