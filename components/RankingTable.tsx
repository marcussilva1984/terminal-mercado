import type { RankingItem } from "@/lib/types";
import { changeColorClass, formatNumber, formatPct } from "@/lib/format";

export function RankingTable({
  items,
  valueLabel = "Preço",
  formatValue = (v: number) => formatNumber(v),
}: {
  items: RankingItem[];
  valueLabel?: string;
  formatValue?: (value: number) => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados disponíveis.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-text-muted">
          <th className="pb-2 font-medium">Ativo</th>
          <th className="pb-2 font-medium text-right">{valueLabel}</th>
          <th className="pb-2 font-medium text-right">Var. %</th>
          {items[0]?.volume !== undefined && (
            <th className="pb-2 font-medium text-right">Volume</th>
          )}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.symbol} className="border-b border-border/50 last:border-0">
            <td className="py-2">
              <div className="font-medium text-text">{item.symbol}</div>
              <div className="text-xs text-text-muted">{item.label}</div>
            </td>
            <td className="py-2 text-right text-text">{formatValue(item.value)}</td>
            <td className={`py-2 text-right ${changeColorClass(item.changePct)}`}>
              {formatPct(item.changePct)}
            </td>
            {item.volume !== undefined && (
              <td className="py-2 text-right text-text-muted">{formatNumber(item.volume, 0)}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
