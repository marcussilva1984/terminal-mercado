import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { portfolioHoldings, priceAlerts } from "@/lib/db/schema";

export interface HoldingInput {
  symbol: string;
  assetClass: string;
  label: string;
  quantity: number;
  avgPrice: number;
  notes?: string;
}

export async function getHoldings() {
  const db = getDb();
  return db.select().from(portfolioHoldings).orderBy(portfolioHoldings.createdAt);
}

export async function addHolding(input: HoldingInput) {
  const db = getDb();
  await db.insert(portfolioHoldings).values(input);
}

export async function removeHolding(id: number) {
  const db = getDb();
  await db.delete(portfolioHoldings).where(eq(portfolioHoldings.id, id));
}

export async function updateHoldingNotes(id: number, notes: string) {
  const db = getDb();
  await db.update(portfolioHoldings).set({ notes }).where(eq(portfolioHoldings.id, id));
}

export interface PriceAlertInput {
  symbol: string;
  assetClass: string;
  label: string;
  direction: "above" | "below";
  targetPrice: number;
}

export async function getActivePriceAlerts() {
  const db = getDb();
  return db.select().from(priceAlerts).where(eq(priceAlerts.active, "true"));
}

export async function addPriceAlert(input: PriceAlertInput) {
  const db = getDb();
  await db.insert(priceAlerts).values(input);
}

export async function removePriceAlert(id: number) {
  const db = getDb();
  await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
}

export async function markPriceAlertTriggered(id: number) {
  const db = getDb();
  await db.update(priceAlerts).set({ active: "false", triggeredAt: new Date() }).where(eq(priceAlerts.id, id));
}
