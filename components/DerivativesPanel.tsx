import { formatNumber, formatPct, formatUSDCompact, changeColorClass } from "@/lib/format";
import type { DerivativeSnapshot } from "@/lib/sources/binanceFutures";

function Bar({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-alt">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

// Long/short account ratio como barra comprada x vendida — infográfico pedido
// pelo usuário em vez de só número cru.
export function LongShortPanel({ items }: { items: DerivativeSnapshot[] }) {
  const sorted = [...items].sort((a, b) => a.longShortRatio - b.longShortRatio); // mais vendido primeiro
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((d) => (
        <div key={d.symbol} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text">{d.symbol}</span>
            <span className="text-text-muted">
              {formatNumber(d.longPct, 0)}% long / {formatNumber(d.shortPct, 0)}% short
              <span className={`ml-2 ${changeColorClass(d.lsChange1dPct)}`}>
                ({formatPct(d.lsChange1dPct)} 1d)
              </span>
            </span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-down/30">
            <div className="h-full bg-up" style={{ width: `${d.longPct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Funding rate: positivo = longs pagam shorts (mercado "esticado" comprado);
// negativo = shorts pagam longs (mercado esticado vendido / crowded short).
export function FundingRateTable({ items }: { items: DerivativeSnapshot[] }) {
  const sorted = [...items].sort((a, b) => b.fundingRatePct - a.fundingRatePct);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="pb-2 font-medium">Símbolo</th>
            <th className="pb-2 font-medium text-right">Funding (8h)</th>
            <th className="pb-2 font-medium text-right">Δ 1d</th>
            <th className="pb-2 font-medium text-right">Δ 1sem</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.symbol} className="border-t border-border">
              <td className="py-1.5 font-medium text-text">{d.symbol}</td>
              <td className={`py-1.5 text-right ${changeColorClass(d.fundingRatePct)}`}>{formatPct(d.fundingRatePct)}</td>
              <td className={`py-1.5 text-right ${changeColorClass(d.fundingRateChange1d)}`}>{formatPct(d.fundingRateChange1d)}</td>
              <td className={`py-1.5 text-right ${changeColorClass(d.fundingRateChange1w)}`}>{formatPct(d.fundingRateChange1w)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Positivo = longs pagando shorts (mercado comprado demais). Negativo = shorts pagando longs
        (mercado vendido demais / &quot;crowded short&quot;).
      </p>
    </div>
  );
}

export function OpenInterestPanel({ items }: { items: DerivativeSnapshot[] }) {
  const sorted = [...items].sort((a, b) => b.openInterestUsd - a.openInterestUsd);
  const max = sorted[0]?.openInterestUsd ?? 1;
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((d) => (
        <div key={d.symbol} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text">{d.symbol}</span>
            <span className="text-text-muted">
              {formatUSDCompact(d.openInterestUsd)}
              <span className={`ml-2 ${changeColorClass(d.oiChange1dPct)}`}>{formatPct(d.oiChange1dPct)} 1d</span>
              <span className={`ml-2 ${changeColorClass(d.oiChange1wPct)}`}>{formatPct(d.oiChange1wPct)} 1sem</span>
              <span className={`ml-2 ${changeColorClass(d.oiChange1mPct)}`}>{formatPct(d.oiChange1mPct)} ~1mês</span>
            </span>
          </div>
          <Bar pct={(d.openInterestUsd / max) * 100} colorClass="bg-gold-bright" />
        </div>
      ))}
    </div>
  );
}
