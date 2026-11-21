import { formatCompact } from "@/lib/format";
import type { ProtocolTvl } from "@/lib/sources/defillama";

function changeColor(pct: number | null) {
  if (pct === null) return "text-text-muted";
  return pct >= 0 ? "text-up" : "text-down";
}

export function TvlPanel({ items }: { items: ProtocolTvl[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Nenhum ativo da watchlist é um protocolo DeFi com TVL relevante (blockchains como BTC/ETH/SOL
        não têm "TVL próprio" nesse sentido).
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((p) => (
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
        TVL via DefiLlama — só protocolos DeFi da watchlist (DEX, empréstimo, staking líquido etc.). Variação 1d e 7d.
      </p>
    </div>
  );
}
