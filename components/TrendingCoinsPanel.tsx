import type { TrendingCoin } from "@/lib/sources/coingecko";
import { changeColorClass, formatPct } from "@/lib/format";

export function TrendingCoinsPanel({ items }: { items: TrendingCoin[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados disponíveis.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col divide-y divide-border/50">
        {items.map((c, i) => (
          <li key={c.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-sm">
            <span className="text-text">
              <span className="text-text-muted">#{i + 1}</span> {c.symbol} <span className="text-text-muted">— {c.name}</span>
              {c.marketCapRank && <span className="ml-1 text-xs text-text-muted">(rank #{c.marketCapRank})</span>}
            </span>
            {c.priceChangePct24h !== null && (
              <span className={changeColorClass(c.priceChangePct24h)}>{formatPct(c.priceChangePct24h)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        Moedas mais buscadas na CoinGecko agora — proxy de atenção/interesse do mercado, não é
        recomendação. Atualiza a cada 10min.
      </p>
    </div>
  );
}
