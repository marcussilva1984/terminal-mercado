import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { hasDatabase } from "@/lib/db/client";
import { hasRecentAlert, logAlert, hasAnyAlertWithKeyPrefix } from "@/lib/db/alertRepo";
import { getB3FatosRelevantes } from "@/lib/sources/b3Plantao";
import { sendTelegramMessage, hasTelegramConfig, escapeHtml } from "@/lib/sources/telegram";

export const maxDuration = 60;

const KEY_PREFIX = "fato_relevante:b3:";

// Fonte: Plantão de Notícias da B3 (tempo real). Dedup pelo id do comunicado.
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ sent: false, reason: "DATABASE_URL não configurada" });
  }
  if (!hasTelegramConfig()) {
    return NextResponse.json({ sent: false, reason: "Telegram não configurado" });
  }

  let fatos;
  try {
    fatos = await getB3FatosRelevantes();
  } catch (e) {
    console.error("Plantão da B3 indisponível:", e);
    return NextResponse.json({ sent: false, error: String(e) }, { status: 502 });
  }

  // Primeira rodada com a fonte nova: marca o que já existe como visto, senão
  // manda dezenas de mensagens de uma vez.
  if (!(await hasAnyAlertWithKeyPrefix(KEY_PREFIX))) {
    for (const f of fatos) await logAlert(`${KEY_PREFIX}${f.id}`, f.headline, "fato_relevante", f.url);
    return NextResponse.json({ sent: true, count: 0, bootstrapped: fatos.length });
  }

  let sent = 0;
  for (const f of fatos) {
    const key = `${KEY_PREFIX}${f.id}`;
    if (await hasRecentAlert(key, 24 * 30)) continue;

    const hora = f.dateTime.slice(11, 16);
    const text = `📢 <b>Fato Relevante — B3</b>\n${escapeHtml(f.company)}\n${hora} · ${escapeHtml(f.url)}`;
    // Só grava o dedup se o envio deu certo, senão o fato se perde.
    try {
      await sendTelegramMessage(text);
      await logAlert(key, f.headline, "fato_relevante", f.url);
      sent++;
    } catch (e) {
      console.error("Falha ao enviar Fato Relevante pro Telegram:", e, f.url);
    }
  }

  return NextResponse.json({ sent: true, count: sent, checked: fatos.length });
}
