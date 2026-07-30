import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getLastDigestTime, markDigestSent } from "@/lib/db/alertRepo";
import { getAllNewsWithCategory } from "@/lib/sources/rss";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";
import { getNewsPriority } from "@/lib/sentiment";

// Telegram não suporta cor de texto (só HTML básico: negrito, itálico, link) —
// usa emoji como substituto visual de prioridade nas mensagens.
const PRIORITY_EMOJI: Record<"alta" | "media" | "baixa", string> = { alta: "🔴", media: "🟡", baixa: "⚪" };

const CATEGORY_LABEL: Record<string, string> = {
  b3: "B3 / Brasil",
  cripto: "Cripto",
  internacional: "Internacional (mercado)",
  forex: "Forex",
  fii: "FII",
  geral: "Geral",
};

// Limite de segurança pra uma rodada não disparar uma enxurrada de mensagens
// se o cron ficar muito tempo sem rodar (ex.: deploy fora do ar por horas).
const MAX_MESSAGES_PER_RUN = 40;

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

  const lastRun = await getLastDigestTime();
  const cutoff = lastRun ?? new Date(Date.now() - 35 * 60 * 1000); // primeira vez: últimos 35 min

  const allNews = await getAllNewsWithCategory(200);
  const fresh = allNews
    .filter((item) => new Date(item.publishedAt).getTime() > cutoff.getTime())
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
    .slice(0, MAX_MESSAGES_PER_RUN);

  if (fresh.length === 0) {
    await markDigestSent();
    return NextResponse.json({ sent: true, count: 0 });
  }

  // Uma mensagem por notícia (em vez de um bloco com várias) — assim o
  // Telegram consegue montar o preview grande (imagem + descrição) de cada
  // link individualmente, em vez de só previsualizar o primeiro link de uma
  // mensagem com vários.
  for (const item of fresh) {
    const label = CATEGORY_LABEL[item.category] ?? item.category;
    const priority = getNewsPriority(item.title);
    const text = `${PRIORITY_EMOJI[priority]} <b>${label}</b>\n<a href="${item.url}">${item.title}</a>\n<i>${item.source}</i>`;
    await sendTelegramMessage(text).catch(() => {});
  }

  await markDigestSent();
  return NextResponse.json({ sent: true, count: fresh.length });
}
