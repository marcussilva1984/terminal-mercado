import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { hasRecentAlert, logAlert, hasAnyAlertWithKeyPrefix } from "@/lib/db/alertRepo";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";

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
      `📢 <b>Fato Relevante — B3</b>\n${fato.companyName}\n${fato.subject}\n` +
      `${new Date(fato.date).toLocaleDateString("pt-BR")}\n${fato.documentUrl}`;

    await sendTelegramMessage(text).catch(() => {});
    await logAlert(key, `${fato.companyName}: ${fato.subject}`, "fato_relevante", fato.documentUrl);
    sent++;
  }

  return NextResponse.json({ sent: true, count: sent });
}
