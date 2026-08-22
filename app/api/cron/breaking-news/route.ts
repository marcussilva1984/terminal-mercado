import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getLastBreakingNewsCheck, markBreakingNewsChecked, logAlert } from "@/lib/db/alertRepo";
import { getAllNewsWithCategory } from "@/lib/sources/rss";
import { getNewsPriority } from "@/lib/sentiment";

// Varre todos os feeds RSS configurados — com cache frio isso passa fácil de
// 10s (timeout padrão da Vercel), derrubando o GitHub Actions que chama esse
// endpoint a cada 10min.
export const maxDuration = 60;

const PRIORITY_EMOJI: Record<"alta" | "media", string> = { alta: "🔴", media: "🟡" };
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";

const CATEGORY_LABEL: Record<string, string> = {
  b3: "B3 / Brasil",
  cripto: "Cripto",
  internacional: "Internacional (mercado)",
  forex: "Forex",
  fii: "FII",
  geral: "Geral",
};

// Roda a cada ~10min (mais frequente que o digest completo de 30min) e só
// dispara pra manchetes de alto impacto (crash, recorde histórico, etc.) —
// não espera o ciclo do digest normal pra essas.
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

  const lastCheck = await getLastBreakingNewsCheck();
  const cutoff = lastCheck ?? new Date(Date.now() - 15 * 60 * 1000);

  const allNews = await getAllNewsWithCategory(200);
  const breaking = allNews
    .filter((item) => new Date(item.publishedAt).getTime() > cutoff.getTime())
    .map((item) => ({ item, priority: getNewsPriority(item.title) }))
    .filter((x): x is { item: (typeof allNews)[number]; priority: "alta" | "media" } => x.priority !== "baixa");

  for (const { item, priority } of breaking) {
    const label = CATEGORY_LABEL[item.category] ?? item.category;
    const priorityLabel = priority === "alta" ? "Alta Prioridade" : "Média Prioridade";
    const text =
      `${PRIORITY_EMOJI[priority]} <b>${priorityLabel} — ${label}</b>\n<a href="${item.url}">${item.title}</a>\n<i>${item.source}</i>`;
    await sendTelegramMessage(text).catch(() => {});
    await logAlert(`noticia:${item.url}`, item.title, "noticia", item.url);
  }

  await markBreakingNewsChecked();
  return NextResponse.json({ sent: true, count: breaking.length });
}
