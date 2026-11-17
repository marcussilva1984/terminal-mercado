import type { ConvictionEntry } from "@/lib/convictionService";

// Ideia 3: card pintado pela convicção — forte vermelho, média amarelo, fraca azul
function convictionStyle(score: number): { border: string; badge: string; label: string } {
  if (score >= 4) return { border: "border-down/50 bg-down/8", badge: "bg-down/20 text-down border-down/40", label: "forte" };
  if (score >= 2) return { border: "border-amber/50 bg-amber/8", badge: "bg-amber/20 text-amber border-amber/40", label: "média" };
  return { border: "border-blue-500/30 bg-blue-500/5", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "fraca" };
}

export function ConvictionRankingList({ items }: { items: ConvictionEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nada se destacando na watchlist agora.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {items.slice(0, 15).map((e) => {
          const style = convictionStyle(e.score);
          return (
            <li
              key={`${e.assetClass}-${e.symbol}`}
              className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${style.border}`}
            >
              <div>
                <span className="font-semibold text-text">{e.symbol}</span>{" "}
                <span className="text-xs text-text-muted">
                  {e.label} · {e.reasons.join(", ")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>
                  {style.label}
                </span>
                <span className="text-xs tabular-nums text-text-muted">{e.score.toFixed(1)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        Score = soma de sinais já existentes (z-score + preço-alvo batido + notícia recente).
        Forte ≥ 4 · Média ≥ 2 · Fraca &lt; 2. Não é recomendação.
      </p>
    </div>
  );
}
