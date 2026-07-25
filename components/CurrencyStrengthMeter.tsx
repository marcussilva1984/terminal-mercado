import type { CurrencyStrength } from "@/lib/forexService";
import { formatNumber } from "@/lib/format";

export function CurrencyStrengthMeter({ items }: { items: CurrencyStrength[] }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.score)), 0.01);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const widthPct = (Math.abs(item.score) / maxAbs) * 50;
        const positive = item.score >= 0;
        return (
          <div key={item.currency} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-sm font-medium text-text">{item.currency}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-panel-alt">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute inset-y-0 ${positive ? "left-1/2 bg-up" : "right-1/2 bg-down"}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className={`w-16 shrink-0 text-right text-xs tabular-nums ${positive ? "text-up" : "text-down"}`}>
              {positive ? "+" : ""}
              {formatNumber(item.score)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
