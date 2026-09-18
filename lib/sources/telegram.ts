export function hasTelegramConfig(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

// parse_mode "HTML" do Telegram trata "&", "<" e ">" cru como marcação em
// QUALQUER parte do texto, não só dentro de tag — título de notícia ou nome
// de empresa com "&" (comum, ex.: "M&A", "Johnson & Johnson") quebra a
// mensagem inteira. Bug real encontrado: os crons interpolavam texto de
// fonte externa sem escapar, e o erro do Telegram (400) era engolido em
// silêncio pelo .catch(() => {}) de cada chamador — a mensagem simplesmente
// nunca chegava, sem log nenhum. Escapa só os 5 caracteres que o Telegram
// exige (não é um sanitizador de HTML genérico).
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Sem token/chat_id configurados, vira no-op — não quebra o resto do app.
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // prefer_large_media: card grande com imagem/descrição (o "preview arrumado"
    // que o Telegram já gera sozinho a partir do link, quando é o único link
    // relevante da mensagem — por isso cada notícia vai em mensagem própria).
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { prefer_large_media: true },
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram respondeu ${res.status}`);
  }
}
