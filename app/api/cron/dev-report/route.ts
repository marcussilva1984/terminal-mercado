import { NextResponse } from "next/server";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";

// Endpoint só de entrega: recebe o relatório semanal de saúde/sugestões do
// projeto (gerado pela rotina na nuvem que roda toda semana) e manda pro
// Telegram do usuário — mensagens do Telegram têm limite de ~4096
// caracteres, então quebra em pedaços se precisar.
const TELEGRAM_CHUNK_SIZE = 3800;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasTelegramConfig()) {
    return NextResponse.json({ sent: false, reason: "Telegram não configurado" });
  }

  const body = await request.json().catch(() => null);
  const message = body?.message;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "campo 'message' (string) obrigatório" }, { status: 400 });
  }

  const chunks: string[] = [];
  for (let i = 0; i < message.length; i += TELEGRAM_CHUNK_SIZE) {
    chunks.push(message.slice(i, i + TELEGRAM_CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    await sendTelegramMessage(chunk);
  }

  return NextResponse.json({ sent: true, chunks: chunks.length });
}
