"use client";

import { useState } from "react";
import type { ZScoreHighlight } from "@/lib/types";
import { changeColorClass, formatPct } from "@/lib/format";
import { ZScoreBadge } from "@/components/ZScoreBadge";

export function ZScoreHighlightList({ items }: { items: ZScoreHighlight[] }) {
  const [count, setCount] = useState(10);

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados disponíveis.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-text-muted">
          Baseado na Watchlist — adicione mais ativos em{" "}
          <a href="/watchlist" className="text-gold-bright hover:underline">
            Watchlist
          </a>
          .
        </span>
        {items.length > 5 && (
          <input
            type="number"
            min={1}
            max={items.length}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(items.length, Number(e.target.value) || 1)))}
            className="w-14 rounded border border-border bg-panel-alt px-1.5 py-0.5 text-xs text-text"
          />
        )}
      </div>
      <div className="flex flex-col divide-y divide-border/50">
        {items.slice(0, count).map((z) => (
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
    </div>
  );
}
