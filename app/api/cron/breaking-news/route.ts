import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getLastBreakingNewsCheck, markBreakingNewsChecked } from "@/lib/db/alertRepo";
import { getAllNewsWithCategory } from "@/lib/sources/rss";
import { isExtremeNews } from "@/lib/sentiment";
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
  const breaking = allNews.filter(
    (item) => new Date(item.publishedAt).getTime() > cutoff.getTime() && isExtremeNews(item.title)
  );

  for (const item of breaking) {
    const label = CATEGORY_LABEL[item.category] ?? item.category;
    const text =
      `🚨 <b>Alto impacto — ${label}</b>\n${item.title}\n<i>${item.source}</i>\n${item.url}`;
    await sendTelegramMessage(text).catch(() => {});
  }

  await markBreakingNewsChecked();
  return NextResponse.json({ sent: true, count: breaking.length });
}
