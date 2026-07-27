import { formatPrice, formatPct, changeColorClass } from "@/lib/format";

export interface AnalystTargetRow {
  symbol: string;
  label: string;
  currentPrice: number;
  targetPrice: number;
  upsidePct: number;
  recommendation: string | null;
}

function recomLabel(recom: string | null): string {
  const n = recom ? parseFloat(recom) : null;
  if (n === null || Number.isNaN(n)) return "—";
  if (n <= 1.5) return "Compra forte";
  if (n <= 2.5) return "Compra";
  if (n <= 3.5) return "Neutro";
  if (n <= 4.5) return "Venda";
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
            <th className="pb-2 font-medium text-right">Preço-Alvo (méd.)</th>
            <th className="pb-2 font-medium text-right">Upside/Downside</th>
            <th className="pb-2 font-medium text-right">Recomendação</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50 last:border-0">
              <td className="py-2">
                <div className="font-medium text-text">{r.symbol}</div>
                <div className="text-xs text-text-muted">{r.label}</div>
              </td>
              <td className="py-2 text-right text-text">{formatPrice(r.currentPrice, "USD")}</td>
              <td className="py-2 text-right text-gold-bright">{formatPrice(r.targetPrice, "USD")}</td>
              <td className={`py-2 text-right font-medium ${changeColorClass(r.upsidePct)}`}>{formatPct(r.upsidePct)}</td>
              <td className="py-2 text-right text-text-muted">{recomLabel(r.recommendation)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Preço-alvo médio dos analistas via Finviz. Recomendação numérica do Finviz: 1 = compra forte, 5 = venda
        forte (média das casas que cobrem o papel).
      </p>
    </div>
  );
}
