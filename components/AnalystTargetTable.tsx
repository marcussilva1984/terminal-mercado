import { formatPrice, formatPct, changeColorClass } from "@/lib/format";

export interface AnalystTargetRow {
  symbol: string;
  label: string;
  currentPrice: number;
  targetMeanPrice: number;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  upsidePct: number;
  recommendationMean: number | null;
  numberOfAnalysts: number | null;
}

function recomLabel(recom: number | null): string {
  if (recom === null || Number.isNaN(recom)) return "—";
  if (recom <= 1.5) return "Compra forte";
  if (recom <= 2.5) return "Compra";
  if (recom <= 3.5) return "Neutro";
  if (recom <= 4.5) return "Venda";
  return "Venda forte";
}

export function AnalystTargetTable({ items }: { items: AnalystTargetRow[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados de analistas disponíveis no momento.</p>;
  }

  const sorted = [...items].sort((a, b) => b.upsidePct - a.upsidePct);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="pb-2 font-medium">Ativo</th>
            <th className="pb-2 font-medium text-right">Preço Atual</th>
            <th className="pb-2 font-medium text-right">Alvo (baixo—alto)</th>
            <th className="pb-2 font-medium text-right">Alvo (méd.)</th>
            <th className="pb-2 font-medium text-right">Upside/Downside</th>
            <th className="pb-2 font-medium text-right">Recomendação</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50 last:border-0">
              <td className="py-2">
                <div className="font-medium text-text">{r.symbol}</div>
                <div className="text-xs text-text-muted">
                  {r.label}
                  {r.numberOfAnalysts ? ` · ${r.numberOfAnalysts} analistas` : ""}
                </div>
              </td>
              <td className="py-2 text-right text-text">{formatPrice(r.currentPrice, "USD")}</td>
              <td className="py-2 text-right text-text-muted">
                {r.targetLowPrice !== null && r.targetHighPrice !== null
                  ? `${formatPrice(r.targetLowPrice, "USD")} — ${formatPrice(r.targetHighPrice, "USD")}`
                  : "—"}
              </td>
              <td className="py-2 text-right text-gold-bright">{formatPrice(r.targetMeanPrice, "USD")}</td>
              <td className={`py-2 text-right font-medium ${changeColorClass(r.upsidePct)}`}>{formatPct(r.upsidePct)}</td>
              <td className="py-2 text-right text-text-muted">{recomLabel(r.recommendationMean)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Preço-alvo dos analistas via Yahoo Finance (mesma API que o site do Yahoo usa, sem chave). Recomendação:
        1 = compra forte, 5 = venda forte (média das casas que cobrem o papel). Não existe fonte gratuita que
        detalhe o alvo por corretora individual (JP Morgan, BofA etc.) — só a média/faixa agregada.
      </p>
    </div>
  );
}
