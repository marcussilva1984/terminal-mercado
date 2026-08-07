import { NextResponse } from "next/server";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments } from "@/lib/semaphore";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getBrapiRanking, type BrapiListItem } from "@/lib/sources/brapi";
import { getRecentAlerts } from "@/lib/db/alertRepo";
import { buildB3Insights } from "@/lib/insights";
import { buildDailySummaryMarkdown, buildDailySummaryTelegramHTML } from "@/lib/dailySummary";
import type { RankingItem } from "@/lib/types";

function toRankingItem(item: BrapiListItem): RankingItem {
  return { symbol: item.symbol, label: item.name, value: item.close, changePct: item.changePct, volume: item.volume };
}

export async function GET() {
  const [flowResult, zScoreResult, gainersResult, losersResult, volumeResult, alertsResult] =
    await Promise.allSettled([
      getFlowHistory(),
      getZScoreHighlights("b3"),
      getBrapiRanking("change", "desc", 5),
      getBrapiRanking("change", "asc", 5),
      getBrapiRanking("volume", "desc", 10),
      getRecentAlerts(24),
    ]);

  const flowSegments = flowResult.status === "fulfilled" ? buildFlowSegments(flowResult.value) : null;
  const zScoreHighlights = zScoreResult.status === "fulfilled" ? zScoreResult.value : null;
  const altas = gainersResult.status === "fulfilled" ? gainersResult.value.map(toRankingItem) : null;
  const baixas = losersResult.status === "fulfilled" ? losersResult.value.map(toRankingItem) : null;
  const byVolume = volumeResult.status === "fulfilled" ? volumeResult.value.map(toRankingItem) : null;
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : null;

  const insights =
    altas && baixas && byVolume && flowSegments
      ? buildB3Insights(altas, baixas, byVolume, flowSegments, zScoreHighlights ?? [])
      : [];

  const summaryInput = {
    date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    flowSegments,
    altas: altas?.slice(0, 5) ?? null,
    baixas: baixas?.slice(0, 5) ?? null,
    zScoreHighlights,
    alerts,
    insights,
  };

  return NextResponse.json({
    markdown: buildDailySummaryMarkdown(summaryInput),
    telegramHtml: buildDailySummaryTelegramHTML(summaryInput),
  });
}
