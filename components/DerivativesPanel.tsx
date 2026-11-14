import { formatPct, formatUSDCompact, changeColorClass } from "@/lib/format";
import type { DerivativeSnapshot } from "@/lib/sources/cryptoDerivatives";

function Bar({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-alt">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

// Funding positivo = longs pagam shorts (mercado comprado demais); negativo =
// shorts pagam longs (crowded short). Basis = prêmio do perpétuo sobre o spot.
export function FundingRateTable({ items }: { items: DerivativeSnapshot[] }) {
  const sorted = [...items].sort((a, b) => b.fundingRatePct - a.fundingRatePct);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="pb-2 font-medium">Símbolo</th>
            <th className="pb-2 text-right font-medium">Funding (8h)</th>
            <th className="pb-2 text-right font-medium">Funding a.a.</th>
            <th className="pb-2 text-right font-medium">Basis</th>
            <th className="pb-2 text-right font-medium">Preço 24h</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.symbol} className="border-t border-border tabular-nums">
              <td className="py-1.5 font-medium text-text">{d.symbol}</td>
              <td className={`py-1.5 text-right ${changeColorClass(d.fundingRatePct)}`}>{d.fundingRatePct.toFixed(4)}%</td>
              <td className={`py-1.5 text-right ${changeColorClass(d.fundingRatePct)}`}>{formatPct(d.fundingRatePct * 3 * 365)}</td>
              <td className={`py-1.5 text-right ${changeColorClass(d.basisPct)}`}>{formatPct(d.basisPct)}</td>
              <td className={`py-1.5 text-right ${changeColorClass(d.change24hPct)}`}>{formatPct(d.change24hPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Funding positivo = longs pagando shorts (mercado comprado demais); negativo = shorts pagando longs (&quot;crowded
        short&quot;). Basis positivo = perpétuo negociando acima do spot.
      </p>
    </div>
  );
}

export function OpenInterestPanel({ items }: { items: DerivativeSnapshot[] }) {
  const sorted = [...items].sort((a, b) => b.openInterestUsd - a.openInterestUsd);
  const max = sorted[0]?.openInterestUsd || 1;
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((d) => (
        <div key={d.symbol} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text">{d.symbol}</span>
            <span className="text-text-muted tabular-nums">
              {formatUSDCompact(d.openInterestUsd)}
              <span className="ml-2">vol 24h {formatUSDCompact(d.volume24hUsd)}</span>
            </span>
          </div>
          <Bar pct={(d.openInterestUsd / max) * 100} colorClass="bg-gold-bright" />
        </div>
      ))}
    </div>
  );
}
