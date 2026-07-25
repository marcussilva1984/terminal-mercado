import { and, desc, gte, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { alertLog } from "@/lib/db/schema";
import type { AlertStatus } from "@/lib/types";

// Já existe um alerta para essa `key` nas últimas `hours` horas? Evita notificar
// a mesma condição repetidamente (ex.: mesmo z-score extremo todo dia).
export async function hasRecentAlert(key: string, hours: number): Promise<boolean> {
  const db = getDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db
    .select({ id: alertLog.id })
    .from(alertLog)
    .where(and(eq(alertLog.key, key), gte(alertLog.triggeredAt, since)))
    .limit(1);
  return rows.length > 0;
}

export async function logAlert(key: string, label: string, kind: string): Promise<void> {
  const db = getDb();
  await db.insert(alertLog).values({ key, label, kind });
}

export async function getRecentAlerts(hours = 24): Promise<AlertStatus[]> {
  const db = getDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(alertLog)
    .where(gte(alertLog.triggeredAt, since))
    .orderBy(desc(alertLog.triggeredAt))
    .limit(20);

  return rows.map((r) => ({
    label: r.label,
    triggeredAt: r.triggeredAt.toISOString(),
    kind: r.kind as AlertStatus["kind"],
  }));
}
