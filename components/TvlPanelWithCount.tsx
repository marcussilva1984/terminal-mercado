"use client";

import { useState } from "react";
import { formatCompact } from "@/lib/format";
import type { ProtocolTvl } from "@/lib/sources/defillama";

function changeColor(pct: number | null) {
  if (pct === null) return "text-text-muted";
  return pct >= 0 ? "text-up" : "text-down";
}

export function TvlPanelWithCount({ items }: { items: ProtocolTvl[] }) {
  const [count, setCount] = useState(Math.min(items.length, 10));

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Nenhum ativo da watchlist é um protocolo DeFi com TVL relevante.
      </p>
    );
  }

  const visible = items.slice(0, count);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-text-muted">Quantos protocolos:</label>
        <input
          type="number"
          min={1}
          max={Math.min(50, items.length)}
          value={count}
          onChange={(e) => {
            const v = Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1));
            setCount(Math.min(v, items.length));
          }}
          className="w-16 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text focus:outline-none focus:ring-1 focus:ring-gold-bright"
        />
        <span className="text-xs text-text-muted">de {items.length} disponíveis</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visible.map((p) => (
          <div
            key={p.symbol}
            className="flex flex-col gap-0.5 rounded border border-border bg-panel-alt px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-sm font-bold text-text">{p.symbol}</span>
              {p.change1dPct !== null && (
                <span className={`text-[10px] font-medium ${changeColor(p.change1dPct)}`}>
                  {p.change1dPct >= 0 ? "+" : ""}{p.change1dPct.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-xs font-semibold tabular-nums text-text-muted">
              {formatCompact(p.tvlUsd, "US$")}
            </div>
            {p.change7dPct !== null && (
              <div className={`text-[10px] ${changeColor(p.change7dPct)}`}>
                7d: {p.change7dPct >= 0 ? "+" : ""}{p.change7dPct.toFixed(1)}%
              </div>
            )}
            <div className="mt-0.5 text-[10px] text-text-muted truncate" title={p.category}>{p.category}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        TVL via DefiLlama — só protocolos DeFi da watchlist. Variação 1d e 7d.
      </p>
    </div>
  );
}
