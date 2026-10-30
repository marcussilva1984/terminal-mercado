import { hasRecentAlert, logAlert } from "@/lib/db/alertRepo";
import { sendTelegramMessage, hasTelegramConfig, escapeHtml } from "@/lib/sources/telegram";

// Escapa o label (pode conter nome de empresa/setor com "&" vindo de fonte
// externa — o mesmo bug de HTML quebrado corrigido nos outros crons de
// Telegram) e só grava o dedup (logAlert) depois do envio realmente
// funcionar, senão uma falha de envio marca o alerta como "já visto" e ele
// nunca mais dispara.
export async function notify(key: string, label: string, kind: string, hoursCooldown: number): Promise<boolean> {
  if (await hasRecentAlert(key, hoursCooldown)) return false;
  if (hasTelegramConfig()) {
    try {
      await sendTelegramMessage(`📡 <b>Terminal de Mercado</b>\n${escapeHtml(label)}`);
    } catch (e) {
      console.error("Falha ao enviar alerta pro Telegram:", e, label);
      return false;
    }
  }
  await logAlert(key, label, kind);
  return true;
}
