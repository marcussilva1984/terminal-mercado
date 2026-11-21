"use client";

import { useState } from "react";
import { formatCompact } from "@/lib/format";
import type { CoinMarket } from "@/lib/sources/coingecko";

function changeColor(pct: number | null) {
  if (pct === null) return "text-text-muted";
  return pct >= 0 ? "text-up" : "text-down";
}

export function VolumeAnomalPanel({ coins }: { coins: CoinMarket[] }) {
  const [count, setCount] = useState(10);

  const visible = coins.slice(0, count);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-text-muted">Quantos ativos:</label>
        <input
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => {
            const v = Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1));
            setCount(v);
          }}
          className="w-16 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text focus:outline-none focus:ring-1 focus:ring-gold-bright"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visible.map((c) => (
          <div
            key={c.symbol}
            className="flex flex-col gap-0.5 rounded border border-border bg-panel-alt px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-sm font-bold text-text">{c.symbol.toUpperCase()}</span>
              {c.price_change_percentage_24h !== null && (
                <span className={`text-[10px] font-medium ${changeColor(c.price_change_percentage_24h)}`}>
                  {c.price_change_percentage_24h >= 0 ? "+" : ""}
                  {c.price_change_percentage_24h.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-[10px] text-text-muted truncate">{c.name}</div>
            <div className="text-xs font-semibold tabular-nums text-text-muted">
              Vol: {formatCompact(c.total_volume, "US$")}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Top {count} criptos por volume 24h via CoinGecko. Ajuste a caixa para ver mais ou menos ativos.
      </p>
    </div>
  );
}
