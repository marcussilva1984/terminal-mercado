import { NextResponse } from "next/server";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";
import { handleTelegramCommand } from "@/lib/telegramAgent";
import { hasDatabase } from "@/lib/db/client";

// Telegram manda o "secret_token" configurado no setWebhook de volta nesse
// header em toda chamada — é como validamos que a requisição é mesmo do
// Telegram e não de alguém que descobriu a URL.
export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!hasTelegramConfig() || !hasDatabase()) {
    return NextResponse.json({ ok: true }); // no-op silencioso, sem config não tem o que fazer
  }

  const update = await request.json().catch(() => null);
  const message = update?.message;
  const chatId = message?.chat?.id ? String(message.chat.id) : null;
  const text: string | undefined = message?.text;

  // Só processa mensagens do dono do bot — ignora qualquer outro chat.
  if (!chatId || chatId !== process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  if (!text) {
    if (message?.voice) {
      await sendTelegramMessage("🎙️ Recebi seu áudio, mas ainda não sei transcrever voz — por enquanto só entendo texto.").catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  try {
    const reply = await handleTelegramCommand(text);
    await sendTelegramMessage(reply);
  } catch (err) {
    await sendTelegramMessage(`⚠️ Erro processando seu comando: ${err instanceof Error ? err.message : "falha desconhecida"}`).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
