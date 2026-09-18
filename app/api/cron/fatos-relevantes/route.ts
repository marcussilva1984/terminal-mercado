import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { hasRecentAlert, logAlert, hasAnyAlertWithKeyPrefix } from "@/lib/db/alertRepo";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";
import { sendTelegramMessage, hasTelegramConfig, escapeHtml } from "@/lib/sources/telegram";

// O CSV anual da CVM às vezes vem lento pra baixar/parsear (sem cache
// quente) — o timeout padrão da Vercel (10s) cortava a função no meio,
// derrubando o GitHub Actions que chama esse endpoint a cada 20min.
export const maxDuration = 60;

// Roda a cada 15-30min via GitHub Actions. Fatos relevantes não têm timestamp
// fino no CSV da CVM (só a data), então o dedup é por documento individual
// (URL única por protocolo) via alert_log, não por corte de tempo como o
// digest de notícias.
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

  const fatos = await getFatosRelevantes(50);

  // Primeira execução: marca tudo como "já visto" sem notificar (senão o
  // primeiro run manda ~50 mensagens de uma vez) — só alerta a partir daqui.
  const isFirstRun = !(await hasAnyAlertWithKeyPrefix("fato_relevante:"));
  if (isFirstRun) {
    for (const fato of fatos) {
      if (!fato.documentUrl) continue;
      await logAlert(`fato_relevante:${fato.documentUrl}`, `${fato.companyName}: ${fato.subject}`, "fato_relevante", fato.documentUrl);
    }
    return NextResponse.json({ sent: true, count: 0, bootstrapped: fatos.length });
  }

  let sent = 0;
  for (const fato of fatos) {
    if (!fato.documentUrl) continue;
    const key = `fato_relevante:${fato.documentUrl}`;
    const already = await hasRecentAlert(key, 24 * 7); // não repete em até 7 dias
    if (already) continue;

    const text =
      `📢 <b>Fato Relevante — B3</b>\n${escapeHtml(fato.companyName)}\n${escapeHtml(fato.subject)}\n` +
      `${new Date(fato.date).toLocaleDateString("pt-BR")}\n${escapeHtml(fato.documentUrl)}`;

    // Só marca como "já alertado" (dedup de 7 dias) se o envio realmente deu
    // certo — antes marcava mesmo quando sendTelegramMessage falhava (ex.:
    // "&" no nome da empresa quebrando o parse HTML do Telegram), perdendo
    // aquele alerta pra sempre porque o próximo run via como "já visto".
    try {
      await sendTelegramMessage(text);
      await logAlert(key, `${fato.companyName}: ${fato.subject}`, "fato_relevante", fato.documentUrl);
      sent++;
    } catch (e) {
      console.error("Falha ao enviar Fato Relevante pro Telegram:", e, fato.documentUrl);
    }
  }

  return NextResponse.json({ sent: true, count: sent });
}
