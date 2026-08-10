import type { ZScoreHighlight, FlowSegment } from "@/lib/types";
import type { CalendarEvent } from "@/lib/sources/economicCalendar";
import type { FatoRelevanteMatch } from "@/lib/valuation";
import { formatPct } from "@/lib/format";

export interface DailyHighlight {
  category: string;
  text: string;
}

interface NewsHeadline {
  title: string;
}

// Só aponta "motivo" quando existe um match real e verificável (Fato
// Relevante da CVM ou notícia que cita o símbolo/ticker no título) — nunca
// infere causa a partir da variação de preço em si, que seria inventar
// justificativa sem base.
function findReason(symbol: string, fatosMatches: FatoRelevanteMatch[], news: NewsHeadline[]): string | null {
  const fato = fatosMatches.find((f) => f.symbol === symbol);
  if (fato) return `possível motivo: ${fato.subject}`;

  const headline = news.find((n) => n.title.toUpperCase().includes(symbol.toUpperCase()));
  if (headline) return `possível motivo: "${headline.title}"`;

  return null;
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
const MIN_HIGHLIGHTS = 10;
const TOP_MOVERS_PER_CLASS = 3;

export function buildDailyHighlights(
  calendarToday: CalendarEvent[],
  flowSegments: FlowSegment[] | null,
  zScoreHighlights: ZScoreHighlight[] | null,
  fatosMatches: FatoRelevanteMatch[] = [],
  news: NewsHeadline[] = []
): DailyHighlight[] {
  const highlights: DailyHighlight[] = [];
  const usedSymbols = new Set<string>();

  for (const event of calendarToday) {
    const time = new Date(event.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    highlights.push({ category: "Calendário", text: `${time} — ${event.country}: ${event.title}` });
  }

  if (flowSegments) {
    for (const seg of flowSegments.filter((s) => s.signal !== "amarelo").sort((a, b) => Math.abs(b.dailyBRL) - Math.abs(a.dailyBRL))) {
      highlights.push({ category: "Ações", text: seg.reading });
    }
  }

  if (zScoreHighlights) {
    for (const [assetClass, label] of Object.entries(CLASS_LABEL)) {
      const classItems = [...zScoreHighlights.filter((z) => z.assetClass === assetClass)].sort(
        (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)
      );
      if (classItems.length === 0) continue;

      const top = classItems[0];
      usedSymbols.add(`${assetClass}:${top.symbol}`);
      if (Math.abs(top.changePct) < QUIET_THRESHOLD) {
        highlights.push({ category: label, text: `Dia parado — maior variação da watchlist foi ${top.symbol} (${formatPct(top.changePct)}).` });
      } else {
        const reason = findReason(top.symbol, fatosMatches, news);
        highlights.push({
          category: label,
          text: `${top.symbol} ${top.changePct >= 0 ? "lidera as altas" : "lidera as baixas"} da watchlist (${formatPct(top.changePct)})${reason ? ` — ${reason}` : ""}.`,
        });
      }

      for (const z of classItems.slice(1, TOP_MOVERS_PER_CLASS)) {
        if (Math.abs(z.changePct) < QUIET_THRESHOLD) continue;
        usedSymbols.add(`${assetClass}:${z.symbol}`);
        highlights.push({
          category: label,
          text: `${z.symbol} também com variação relevante hoje (${formatPct(z.changePct)}).`,
        });
      }
    }

    // Completa até o mínimo com os próximos maiores movimentos da watchlist
    // (qualquer classe) que ainda não entraram — mesmo dado já coletado, só
    // garante volume mínimo de itens pra tela não ficar vazia em dias calmos.
    if (highlights.length < MIN_HIGHLIGHTS) {
      const remaining = [...zScoreHighlights]
        .filter((z) => !usedSymbols.has(`${z.assetClass}:${z.symbol}`))
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
      for (const z of remaining) {
        if (highlights.length >= MIN_HIGHLIGHTS) break;
        highlights.push({
          category: CLASS_LABEL[z.assetClass] ?? z.assetClass,
          text: `${z.symbol} variação de ${formatPct(z.changePct)} hoje.`,
        });
      }
    }
  }

  return highlights;
}
