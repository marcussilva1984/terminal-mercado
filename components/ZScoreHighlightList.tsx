import type { ZScoreHighlight } from "@/lib/types";
import { changeColorClass, formatPct } from "@/lib/format";
import { ZScoreBadge } from "@/components/ZScoreBadge";

export function ZScoreHighlightList({ items }: { items: ZScoreHighlight[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados disponíveis.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border/50">
      {items.map((z) => (
        <div key={`${z.assetClass}-${z.symbol}`} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
          <div>
            <div className="text-sm font-medium text-text">{z.symbol}</div>
            <div className="text-xs text-text-muted">{z.label}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${changeColorClass(z.changePct)}`}>{formatPct(z.changePct)}</span>
            <ZScoreBadge zScore={z.zScore} />
          </div>
        </div>
      ))}
    </div>
  );
}
