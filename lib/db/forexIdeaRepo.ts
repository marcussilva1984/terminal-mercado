import { desc, eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { forexIdeaTracker } from "@/lib/db/schema";

export type TrackedStatus = "aberta" | "alvo" | "stop" | "expirada";

export interface TrackedIdea {
  id: number;
  pair: string;
  symbol: string;
  direction: "alta" | "queda";
  conviction: string;
  kind: string;
  entry: number;
  stop: number;
  target: number;
  status: TrackedStatus;
  exitPrice: number | null;
  resultR: number | null;
  openedAt: string;
  closedAt: string | null;
}

type Row = typeof forexIdeaTracker.$inferSelect;

function toTracked(r: Row): TrackedIdea {
  return {
    id: r.id,
    pair: r.pair,
    symbol: r.symbol,
    direction: r.direction as TrackedIdea["direction"],
    conviction: r.conviction,
    kind: r.kind,
    entry: r.entry,
    stop: r.stop,
    target: r.target,
    status: r.status as TrackedStatus,
    exitPrice: r.exitPrice,
    resultR: r.resultR,
    openedAt: r.openedAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
  };
}

export async function getTrackedIdeas(): Promise<TrackedIdea[]> {
  if (!hasDatabase()) return [];
  const rows = await getDb().select().from(forexIdeaTracker).orderBy(desc(forexIdeaTracker.openedAt));
  return rows.map(toTracked);
}

// O índice único parcial (pair, direction) WHERE status='aberta' faz o
// ON CONFLICT ignorar ideia que já está sendo acompanhada.
export async function openTrackedIdea(values: {
  pair: string;
  symbol: string;
  direction: "alta" | "queda";
  conviction: string;
  kind: string;
  entry: number;
  stop: number;
  target: number;
}): Promise<TrackedIdea | null> {
  const rows = await getDb().insert(forexIdeaTracker).values(values).onConflictDoNothing().returning();
  return rows[0] ? toTracked(rows[0]) : null;
}

export async function closeTrackedIdea(id: number, status: Exclude<TrackedStatus, "aberta">, exitPrice: number, resultR: number) {
  await getDb()
    .update(forexIdeaTracker)
    .set({ status, exitPrice, resultR, closedAt: new Date() })
    .where(eq(forexIdeaTracker.id, id));
}

export interface Scoreboard {
  open: number;
  closed: number;
  wins: number;
  losses: number;
  expired: number;
  hitRate: number | null; // alvo / (alvo + stop)
  avgR: number | null;
  totalR: number;
}

export function computeScoreboard(ideas: TrackedIdea[]): Scoreboard {
  const closed = ideas.filter((i) => i.status !== "aberta");
  const wins = closed.filter((i) => i.status === "alvo").length;
  const losses = closed.filter((i) => i.status === "stop").length;
  const totalR = closed.reduce((s, i) => s + (i.resultR ?? 0), 0);
  return {
    open: ideas.length - closed.length,
    closed: closed.length,
    wins,
    losses,
    expired: closed.length - wins - losses,
    hitRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
    avgR: closed.length > 0 ? totalR / closed.length : null,
    totalR,
  };
}
