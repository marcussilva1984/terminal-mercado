import type { EtfFlowSnapshot } from "@/lib/sources/etfFlow";
import { formatCompact } from "@/lib/format";

const ASSET_LABEL: Record<string, string> = { btc: "Bitcoin (BTC)", eth: "Ethereum (ETH)", sol: "Solana (SOL)" };

function formatSigned(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign} ${formatCompact(Math.abs(value), "US$")}`;
}

export function EtfFlowPanel({ items }: { items: EtfFlowSnapshot[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados disponíveis.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((snap) => (
        <div key={snap.asset} className="rounded border border-border/60 bg-panel-alt/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-gold-bright">{ASSET_LABEL[snap.asset] ?? snap.asset.toUpperCase()}</h4>
            <span className="text-xs text-text-muted">{snap.updatedAt}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-text-muted">Fluxo do dia</div>
              <div className={snap.dailyNetInflowUsd >= 0 ? "text-up" : "text-down"}>{formatSigned(snap.dailyNetInflowUsd)}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Acumulado (total)</div>
              <div className={snap.cumNetInflowUsd >= 0 ? "text-up" : "text-down"}>{formatSigned(snap.cumNetInflowUsd)}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Patrimônio total</div>
              <div className="text-text">{formatCompact(snap.totalNetAssetsUsd, "US$")}</div>
            </div>
          </div>
          {snap.funds.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-border/50">
              {snap.funds.slice(0, 4).map((f) => (
                <li key={f.ticker} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-text-muted">
                    {f.ticker} <span className="text-text-muted/70">({f.institute})</span>
                  </span>
                  <span className={f.dailyNetInflow >= 0 ? "text-up" : "text-down"}>{formatSigned(f.dailyNetInflow)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <p className="text-xs text-text-muted">
        Fluxo líquido diário dos ETFs spot dos EUA, via SoSoValue. Só existe ETF spot aprovado pra
        BTC, ETH e SOL até agora — não tem pra outras criptos.
      </p>
    </div>
  );
}
