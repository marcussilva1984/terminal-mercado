import type { GlobalCryptoData } from "@/lib/sources/coingecko";
import { formatCompact } from "@/lib/format";

export function BtcDominanceBar({ global }: { global: GlobalCryptoData }) {
  const btc = global.btcDominance;
  const eth = global.ethDominance;
  const other = Math.max(0, 100 - btc - eth);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="w-24 shrink-0 text-xs text-text-muted">BTC</span>
        <div className="relative flex-1 h-5 rounded bg-panel-alt overflow-hidden">
          <div className="h-full bg-amber-500/80" style={{ width: `${btc}%` }} />
        </div>
        <span className="w-14 text-right font-semibold tabular-nums text-amber-400">{btc.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="w-24 shrink-0 text-xs text-text-muted">ETH</span>
        <div className="relative flex-1 h-5 rounded bg-panel-alt overflow-hidden">
          <div className="h-full bg-cyan-500/80" style={{ width: `${eth}%` }} />
        </div>
        <span className="w-14 text-right font-semibold tabular-nums text-cyan-400">{eth.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="w-24 shrink-0 text-xs text-text-muted">Alts</span>
        <div className="relative flex-1 h-5 rounded bg-panel-alt overflow-hidden">
          <div className="h-full bg-purple-500/60" style={{ width: `${other}%` }} />
        </div>
        <span className="w-14 text-right font-semibold tabular-nums text-purple-400">{other.toFixed(1)}%</span>
      </div>
      <div className="pt-1 flex gap-4 text-xs text-text-muted">
        <span>Market cap total: <strong className="text-text">{formatCompact(global.totalMarketCapUsd, "US$")}</strong></span>
        <span>Volume 24h: <strong className="text-text">{formatCompact(global.totalVolumeUsd, "US$")}</strong></span>
      </div>
    </div>
  );
}
