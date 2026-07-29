import type { ZScoreHighlight, FlowSegment } from "@/lib/types";
import type { CalendarEvent } from "@/lib/sources/economicCalendar";
import { formatPct } from "@/lib/format";

export interface DailyHighlight {
  category: string;
  text: string;
}

const CLASS_LABEL: Record<string, string> = {
  b3: "Ações",
  cripto: "Cripto",
  stocks: "Stocks",
  fii: "FII",
};

// "Dia parado" abaixo desse limiar — evita chamar de destaque uma variação
// de 0,3% que não significa nada.
const QUIET_THRESHOLD = 1.5;

// Só usa o que já foi coletado nesta mesma carga de página (calendário,
// fluxo, z-score) — nada de resumir texto de notícia, que arriscaria
// inventar detalhe que a fonte não disse.
export function buildDailyHighlights(
  calendarToday: CalendarEvent[],
  flowSegments: FlowSegment[] | null,
  zScoreHighlights: ZScoreHighlight[] | null
): DailyHighlight[] {
  const highlights: DailyHighlight[] = [];

  for (const event of calendarToday.slice(0, 4)) {
    const time = new Date(event.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    highlights.push({ category: "Calendário", text: `${time} — ${event.country}: ${event.title}` });
  }

  if (flowSegments) {
    const strongest = flowSegments
      .filter((s) => s.signal !== "amarelo")
      .sort((a, b) => Math.abs(b.dailyBRL) - Math.abs(a.dailyBRL))[0];
    if (strongest) {
      highlights.push({ category: "Ações", text: strongest.reading });
    }
  }

  if (zScoreHighlights) {
    for (const [assetClass, label] of Object.entries(CLASS_LABEL)) {
      const classItems = zScoreHighlights.filter((z) => z.assetClass === assetClass);
      if (classItems.length === 0) continue;
      const top = [...classItems].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
      if (Math.abs(top.changePct) < QUIET_THRESHOLD) {
        highlights.push({ category: label, text: `Dia parado — maior variação da watchlist foi ${top.symbol} (${formatPct(top.changePct)}).` });
      } else {
        highlights.push({
          category: label,
          text: `${top.symbol} ${top.changePct >= 0 ? "lidera as altas" : "lidera as baixas"} da watchlist (${formatPct(top.changePct)}).`,
        });
      }
    }
  }

  return highlights;
}
