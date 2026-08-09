import { formatCompact } from "@/lib/format";
import type { ProtocolTvl } from "@/lib/sources/defillama";

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
      <ul className="flex flex-col divide-y divide-border/50">
        {items.map((p) => (
          <li key={p.symbol} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
            <div>
              <span className="font-medium text-text">{p.symbol}</span>{" "}
              <span className="text-xs text-text-muted">
                — {p.protocolName} ({p.category})
              </span>
            </div>
            <div className="text-right">
              <div className="text-text">{formatCompact(p.tvlUsd, "US$")}</div>
              {p.change7dPct !== null && (
                <div className={`text-xs ${p.change7dPct >= 0 ? "text-up" : "text-down"}`}>
                  {p.change7dPct >= 0 ? "+" : ""}
                  {p.change7dPct.toFixed(1)}% (7d)
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        TVL (Total Value Locked) via DefiLlama, só pra tokens da watchlist que são protocolos DeFi de
        verdade (empréstimo, DEX, staking líquido, RWA etc.) — blockchains base (BTC, ETH, SOL) ficam
        de fora de propósito, já que "TVL" não se aplica a elas do mesmo jeito. Quando o token tem
        várias versões de protocolo (ex.: Aave V1-V4), o valor é a soma de todas.
      </p>
    </div>
  );
}
