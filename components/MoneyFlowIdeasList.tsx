import type { MoneyFlowIdea, ConvictionLevel, Rationale } from "@/lib/moneyFlowIdeas";

const CONVICTION_BADGE: Record<ConvictionLevel, { emoji: string; label: string; className: string }> = {
  forte: { emoji: "🔴", label: "Convicção forte", className: "border-down/50 bg-down/10 text-down" },
  medio: { emoji: "🟡", label: "Convicção média", className: "border-amber/50 bg-amber/10 text-amber" },
  fraco: { emoji: "🔵", label: "Convicção fraca", className: "border-border bg-panel-alt text-text-muted" },
};

const RATIONALE_LABEL: Record<Rationale, string> = {
  smart_money: "Smart money — sinal técnico/fluxo, sem evento confirmado",
  fundamento: "Fundamento — evento real (notícia, Fato Relevante, dividendo)",
  misto: "Misto — técnico + evento real juntos",
  sem_sinal: "Sem sinal adicional — só maior variação do dia",
};

export function MoneyFlowIdeasList({ items }: { items: MoneyFlowIdea[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum sinal relevante batendo agora na watchlist.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((idea) => {
          const badge = CONVICTION_BADGE[idea.conviction];
          return (
            <div key={`${idea.assetClass}-${idea.symbol}`} className="rounded border border-border bg-panel-alt p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-text">{idea.symbol}</span>{" "}
                  <span className="text-xs text-text-muted">— {idea.label}</span>
                </div>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${badge.className}`}>
                  {badge.emoji} {badge.label}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-gold-bright">{RATIONALE_LABEL[idea.rationale]}</p>
              <p className="mt-1 text-xs text-text-muted">{idea.explanation}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Não é fluxo real de investidor — isso não existe de graça pra B3 nem pra cripto. Convicção =
        quantos sinais que já calculamos em outros painéis bateram juntos no mesmo ativo ao mesmo
        tempo: 🔴 3+ sinais, 🟡 2 sinais, 🔵 1 sinal (ou nenhum, só maior variação do dia).
        &quot;Smart money&quot; aqui é sinal técnico/de fluxo (z-score, volume/TVL fora do padrão,
        atenção do mercado) sem confirmação de evento real; &quot;Fundamento&quot; é evento
        verificável (notícia, Fato Relevante da CVM, dividend yield, preço-alvo de analista). Não é
        recomendação de compra/venda.
      </p>
    </div>
  );
}
