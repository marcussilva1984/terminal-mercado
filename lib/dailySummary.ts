import type { RankingItem, ZScoreHighlight, AlertStatus, FlowSegment } from "@/lib/types";
import { formatPct, formatBRLCompact } from "@/lib/format";

export interface DailySummaryInput {
  date: string;
  flowSegments: FlowSegment[] | null;
  altas: RankingItem[] | null;
  baixas: RankingItem[] | null;
  zScoreHighlights: ZScoreHighlight[] | null;
  alerts: AlertStatus[] | null;
  insights: string[];
}

export function buildDailySummaryMarkdown(input: DailySummaryInput): string {
  const lines: string[] = [];

  lines.push(`# Resumo do Dia — ${input.date}`);
  lines.push("");

  if (input.insights.length > 0) {
    lines.push("## Insights");
    for (const insight of input.insights) lines.push(`- ${insight}`);
    lines.push("");
  }

  if (input.flowSegments && input.flowSegments.length > 0) {
    lines.push("## Fluxo de Investidores B3 (dia)");
    for (const seg of input.flowSegments) {
      lines.push(`- **${seg.segment}**: ${formatBRLCompact(seg.dailyBRL)} — sinal ${seg.signal}`);
    }
    lines.push("");
  }

  if (input.altas && input.altas.length > 0) {
    lines.push("## Maiores Altas — B3");
    for (const item of input.altas) {
      lines.push(`- ${item.symbol} (${item.label}): ${formatPct(item.changePct)}`);
    }
    lines.push("");
  }

  if (input.baixas && input.baixas.length > 0) {
    lines.push("## Maiores Baixas — B3");
    for (const item of input.baixas) {
      lines.push(`- ${item.symbol} (${item.label}): ${formatPct(item.changePct)}`);
    }
    lines.push("");
  }

  if (input.zScoreHighlights && input.zScoreHighlights.length > 0) {
    lines.push("## Z-Score — movimentos fora do padrão");
    for (const z of input.zScoreHighlights.slice(0, 8)) {
      lines.push(`- ${z.symbol} (${z.assetClass.toUpperCase()}): ${formatPct(z.changePct)}, z=${z.zScore.toFixed(1)}`);
    }
    lines.push("");
  }

  if (input.alerts && input.alerts.length > 0) {
    lines.push("## Alertas disparados (24h)");
    for (const a of input.alerts.slice(0, 10)) {
      lines.push(`- [${a.kind}] ${a.label}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Gerado automaticamente pelo Terminal de Mercado._");

  return lines.join("\n");
}
