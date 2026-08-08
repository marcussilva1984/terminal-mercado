import type { ConvictionEntry } from "@/lib/convictionService";

export function ConvictionRankingList({ items }: { items: ConvictionEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nada se destacando na watchlist agora.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col divide-y divide-border/50">
        {items.slice(0, 15).map((e) => (
          <li key={`${e.assetClass}-${e.symbol}`} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-sm">
            <div>
              <span className="font-medium text-text">{e.symbol}</span>{" "}
              <span className="text-xs text-text-muted">
                {e.label} · {e.reasons.join(", ")}
              </span>
            </div>
            <span className="rounded border border-gold/40 px-1.5 py-0.5 text-xs text-gold-bright">{e.score.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        Score = soma de sinais já existentes (z-score + preço-alvo batido + notícia recente) —
        quanto maior, mais coisas relevantes acontecendo ao mesmo tempo com esse ativo. Não é
        recomendação, é só uma forma de priorizar onde olhar primeiro.
      </p>
    </div>
  );
}
