import { and, desc, gte, eq, notInArray, sql } from "drizzle-orm";
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

// Estado do último envio do digest de notícias pro Telegram (evita repetir manchete
// já enviada na rodada anterior).
export async function getLastDigestTime(): Promise<Date | null> {
  const db = getDb();
  const rows = await db
    .select({ triggeredAt: alertLog.triggeredAt })
    .from(alertLog)
    .where(eq(alertLog.key, "news_digest"))
    .orderBy(desc(alertLog.triggeredAt))
    .limit(1);
  return rows[0]?.triggeredAt ?? null;
}

export async function markDigestSent(): Promise<void> {
  await logAlert("news_digest", "Digest de notícias enviado", "noticia");
}

export async function hasAnyAlertWithKeyPrefix(prefix: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: alertLog.id })
    .from(alertLog)
    .where(sql`${alertLog.key} LIKE ${prefix + "%"}`)
    .limit(1);
  return rows.length > 0;
}

// Mesmo padrão do digest completo, mas pra checagem de notícias de alto impacto
// (roda com mais frequência, cutoff próprio pra não competir com o digest).
export async function getLastBreakingNewsCheck(): Promise<Date | null> {
  const db = getDb();
  const rows = await db
    .select({ triggeredAt: alertLog.triggeredAt })
    .from(alertLog)
    .where(eq(alertLog.key, "breaking_news_check"))
    .orderBy(desc(alertLog.triggeredAt))
    .limit(1);
  return rows[0]?.triggeredAt ?? null;
}

export async function markBreakingNewsChecked(): Promise<void> {
  await logAlert("breaking_news_check", "Checagem de notícias de alto impacto", "noticia");
}

// Chaves de bookkeeping interno (dedup de cron), não são alertas de fato pro usuário.
const INTERNAL_KEYS = ["news_digest", "breaking_news_check"];

export async function getRecentAlerts(hours = 24): Promise<AlertStatus[]> {
  const db = getDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(alertLog)
    .where(and(gte(alertLog.triggeredAt, since), notInArray(alertLog.key, INTERNAL_KEYS)))
    .orderBy(desc(alertLog.triggeredAt))
    .limit(20);

  return rows.map((r) => ({
    label: r.label,
    triggeredAt: r.triggeredAt.toISOString(),
    kind: r.kind as AlertStatus["kind"],
  }));
}
