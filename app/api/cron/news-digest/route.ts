import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getLastDigestTime, markDigestSent } from "@/lib/db/alertRepo";
import { getAllNewsWithCategory, type NewsItemWithCategory } from "@/lib/sources/rss";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";

const CATEGORY_LABEL: Record<string, string> = {
  b3: "B3 / Brasil",
  cripto: "Cripto",
  internacional: "Internacional (mercado)",
  forex: "Forex",
  fii: "FII",
  geral: "Geral",
};

const TELEGRAM_MESSAGE_LIMIT = 3500;

function buildMessages(items: NewsItemWithCategory[]): string[] {
  const byCategory = new Map<string, NewsItemWithCategory[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const lines: string[] = [`📰 <b>Notícias — últimos 30 min</b> (${items.length})`];
  for (const [category, categoryItems] of byCategory) {
    lines.push(`\n<b>${CATEGORY_LABEL[category] ?? category}</b>`);
    for (const item of categoryItems) {
      lines.push(`• ${item.title} <i>(${item.source})</i>`);
    }
  }

  // Divide em várias mensagens se passar do limite prático do Telegram.
  const messages: string[] = [];
  let current = "";
  for (const line of lines) {
    if ((current + "\n" + line).length > TELEGRAM_MESSAGE_LIMIT) {
      messages.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) messages.push(current);
  return messages;
}

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
  const fresh = allNews.filter((item) => new Date(item.publishedAt).getTime() > cutoff.getTime());

  if (fresh.length === 0) {
    await markDigestSent();
    return NextResponse.json({ sent: true, count: 0 });
  }

  const messages = buildMessages(fresh);
  for (const msg of messages) {
    await sendTelegramMessage(msg).catch(() => {});
  }

  await markDigestSent();
  return NextResponse.json({ sent: true, count: fresh.length, messages: messages.length });
}
