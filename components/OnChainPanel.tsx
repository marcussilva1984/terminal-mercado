import { formatNumber } from "@/lib/format";
import type { OnChainSnapshot, FearGreedPoint } from "@/lib/sources/onchain";

function mvrvReading(mvrv: number | null): { label: string; className: string } {
  if (mvrv === null) return { label: "—", className: "text-text-muted" };
  if (mvrv >= 3.5) return { label: "Historicamente sobrevalorizado", className: "text-down" };
  if (mvrv >= 2) return { label: "Zona de lucro elevado", className: "text-gold-bright" };
  if (mvrv <= 1) return { label: "Historicamente subvalorizado", className: "text-up" };
  return { label: "Faixa neutra", className: "text-text-muted" };
}

function fearGreedColor(value: number): string {
  if (value <= 25) return "text-down"; // medo extremo
  if (value <= 45) return "text-down/80";
  if (value >= 75) return "text-up"; // ganância extrema
  if (value >= 55) return "text-up/80";
  return "text-text-muted";
}

export function OnChainPanel({
  snapshots,
  fearGreed,
}: {
  snapshots: OnChainSnapshot[];
  fearGreed: FearGreedPoint | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {fearGreed && (
        <div className="flex items-center justify-between rounded-md border border-border bg-panel-alt px-4 py-3">
          <span className="text-sm font-medium text-text">Fear &amp; Greed Index (mercado geral)</span>
          <span className={`text-sm font-semibold ${fearGreedColor(fearGreed.value)}`}>
            {fearGreed.value} — {fearGreed.classification}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {snapshots.map((s) => {
          const reading = mvrvReading(s.mvrv);
          return (
            <div key={s.asset} className="rounded-md border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold text-gold-bright">{s.asset}</h3>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">MVRV</dt>
                  <dd className="text-text">
                    {s.mvrv !== null ? formatNumber(s.mvrv) : "—"}{" "}
                    <span className={`text-xs ${reading.className}`}>({reading.label})</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Endereços ativos (24h)</dt>
                  <dd className="text-text">
                    {s.activeAddresses !== null ? formatNumber(s.activeAddresses, 0) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Transações (24h)</dt>
                  <dd className="text-text">{s.txCount !== null ? formatNumber(s.txCount, 0) : "—"}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">
        MVRV = capitalização de mercado / capitalização realizada — proxy de quão &quot;esticado&quot;
        está o preço frente ao custo médio de quem comprou. Dados via Coin Metrics Community API
        (gratuita). Cobertura limitada a BTC e ETH — altcoins não têm dado on-chain gratuito
        disponível nesse tier.
      </p>
    </div>
  );
}
