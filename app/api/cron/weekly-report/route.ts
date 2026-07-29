import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { getRecentAlerts } from "@/lib/db/alertRepo";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { getFlowChartData, SEGMENT_CONFIG } from "@/lib/semaphore";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";
import { getWeeklyCalendar, filterHighSignal } from "@/lib/sources/economicCalendar";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";
import { formatBRLCompact, formatPct } from "@/lib/format";
import type { AssetClass } from "@/lib/types";

const ALL_CLASSES: AssetClass[] = ["b3", "cripto", "fii", "stocks"];

interface WeeklyMover {
  symbol: string;
  assetClass: AssetClass;
  changePct: number;
}

async function getWeeklyMovers(): Promise<WeeklyMover[]> {
  const movers: WeeklyMover[] = [];
  for (const cls of ALL_CLASSES) {
    const items = await getWatchlist(cls);
    for (const item of items) {
      const closes = await getCloses(item.symbol, cls, 60);
      const week = closes.slice(-7);
      if (week.length < 2) continue;
      const first = week[0].closePrice;
      const last = week[week.length - 1].closePrice;
      if (first === 0) continue;
      movers.push({ symbol: item.symbol, assetClass: cls, changePct: ((last - first) / first) * 100 });
    }
  }
  return movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

// Roda 1x/domingo à noite — resumo do que aconteceu na semana que passou +
// o que fica no radar pra semana que vem (calendário econômico de alto
// impacto). Combina fontes que já coletamos ao longo da semana em vez de
// buscar dado novo, então não deveria falhar mesmo se uma fonte pontual
// estiver fora do ar.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ sent: false, reason: "DATABASE_URL não configurada" });
  }
  if (!hasTelegramConfig()) {
    return NextResponse.json({ sent: false, reason: "Telegram não configurado" });
  }

  const sections: string[] = [];
  sections.push("📅 <b>Relatório Semanal — Terminal de Mercado</b>");

  // 1. Fluxo B3 da semana
  try {
    const history = await getFlowHistory();
    const lines = SEGMENT_CONFIG.map((s) => getFlowChartData(history, s.key, 20))
      .map((d) => `• ${d.segment}: ${formatBRLCompact(d.weekBRL)}`)
      .join("\n");
    sections.push(`💹 <b>Fluxo B3 na semana</b>\n${lines}`);
  } catch {
    // fonte indisponível — segue pras demais seções
  }

  // 2. Maiores movimentos da semana (watchlist, todas as classes)
  try {
    const movers = await getWeeklyMovers();
    if (movers.length > 0) {
      const lines = movers
        .slice(0, 8)
        .map((m) => `• ${m.symbol} (${m.assetClass.toUpperCase()}): ${formatPct(m.changePct)}`)
        .join("\n");
      sections.push(`📊 <b>Maiores movimentos da semana — Watchlist</b>\n${lines}`);
    }
  } catch {
    // sem histórico suficiente ainda
  }

  // 3. Z-score fora do padrão agora (fechamento da semana)
  try {
    const zScores = (await getZScoreHighlights()).filter((z) => Math.abs(z.zScore) >= 2).slice(0, 5);
    if (zScores.length > 0) {
      const lines = zScores.map((z) => `• ${z.symbol}: z ${z.zScore >= 0 ? "+" : ""}${z.zScore.toFixed(1)}`).join("\n");
      sections.push(`⚠️ <b>Fora do padrão agora (z-score)</b>\n${lines}`);
    }
  } catch {
    // z-score indisponível
  }

  // 4. Fatos relevantes da semana
  try {
    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const fatos = (await getFatosRelevantes(50)).filter((f) => new Date(f.date).getTime() >= weekStart.getTime());
    if (fatos.length > 0) {
      sections.push(`📢 <b>Fatos Relevantes B3 na semana</b>: ${fatos.length} comunicados publicados.`);
    }
  } catch {
    // fonte indisponível
  }

  // 5. Notícias de alta/média prioridade da semana (já logadas pelo cron de breaking news)
  try {
    const alerts = await getRecentAlerts(24 * 7, 100);
    const news = alerts.filter((a) => a.kind === "noticia").slice(0, 8);
    if (news.length > 0) {
      const lines = news.map((n) => `• ${n.url ? `<a href="${n.url}">${n.label}</a>` : n.label}`).join("\n");
      sections.push(`🚨 <b>Manchetes de destaque na semana</b>\n${lines}`);
    }
  } catch {
    // sem alertas no período
  }

  // 6. O que ficar de olho na semana que vem — calendário econômico de alto/médio impacto
  try {
    const calendar = await getWeeklyCalendar();
    const highSignal = filterHighSignal(calendar).slice(0, 8);
    if (highSignal.length > 0) {
      const lines = highSignal
        .map((e) => `• ${new Date(e.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} — ${e.country}: ${e.title}`)
        .join("\n");
      sections.push(`🔭 <b>Fique de olho na semana que vem</b>\n${lines}`);
    }
  } catch {
    // calendário indisponível
  }

  if (sections.length === 1) {
    return NextResponse.json({ sent: false, reason: "Sem dados suficientes pra montar o relatório desta semana" });
  }

  const text = sections.join("\n\n");
  // Telegram limita ~4096 caracteres por mensagem — corta com aviso se passar.
  const finalText = text.length > 4000 ? `${text.slice(0, 3950)}\n\n[...continua no dashboard]` : text;
  await sendTelegramMessage(finalText).catch(() => {});

  return NextResponse.json({ sent: true, sections: sections.length });
}
