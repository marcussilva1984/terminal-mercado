import { getDb, hasDatabase } from "@/lib/db/client";
import { forexBrokerEntries } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export interface ForexEntry {
  id: number;
  broker: string;
  balanceUsd: number;
  depositUsd: number;
  withdrawalUsd: number;
  recordedAt: string;
  createdAt: Date;
}

export async function getForexEntries(): Promise<ForexEntry[]> {
  if (!hasDatabase()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(forexBrokerEntries)
    .orderBy(desc(forexBrokerEntries.recordedAt), desc(forexBrokerEntries.createdAt));
  return rows.map((r) => ({
    id: r.id,
    broker: r.broker,
    balanceUsd: r.balanceUsd,
    depositUsd: r.depositUsd ?? 0,
    withdrawalUsd: r.withdrawalUsd ?? 0,
    recordedAt: r.recordedAt,
    createdAt: r.createdAt,
  }));
}

export async function addForexEntry(
  broker: string,
  balanceUsd: number,
  depositUsd: number,
  withdrawalUsd: number,
  recordedAt: string
): Promise<void> {
  const db = getDb();
  await db.insert(forexBrokerEntries).values({ broker, balanceUsd, depositUsd, withdrawalUsd, recordedAt });
}

export async function deleteForexEntry(id: number): Promise<void> {
  const db = getDb();
  const { eq } = await import("drizzle-orm");
  await db.delete(forexBrokerEntries).where(eq(forexBrokerEntries.id, id));
}
