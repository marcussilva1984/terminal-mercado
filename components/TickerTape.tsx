import type { Quote } from "@/lib/types";
import { changeColorClass, formatPct, formatPrice } from "@/lib/format";

function TickerItem({ quote }: { quote: Quote }) {
  return (
    <span className="inline-flex items-center gap-2 px-4 text-sm whitespace-nowrap">
      <span className="font-semibold text-text">{quote.symbol}</span>
      <span className="text-text-muted">{formatPrice(quote.price, quote.currency)}</span>
      <span className={changeColorClass(quote.changePct)}>{formatPct(quote.changePct)}</span>
    </span>
  );
}

export function TickerTape({ quotes }: { quotes: Quote[] }) {
  const loop = [...quotes, ...quotes];
  // Duração proporcional à quantidade de ativos — sem isso, adicionar mais
  // itens (ex.: watchlist) deixaria a faixa "andando" mais rápido pra
  // percorrer o mesmo espaço no mesmo tempo fixo. ~3s por ativo dá ritmo
  // confortável de leitura mesmo com a watchlist inteira somada.
  const durationSeconds = Math.max(50, quotes.length * 3);
  return (
    <div className="w-full overflow-hidden border-b border-border bg-panel">
      <div className="flex w-max animate-ticker py-2" style={{ animationDuration: `${durationSeconds}s` }}>
        {loop.map((q, i) => (
          <TickerItem key={`${q.symbol}-${i}`} quote={q} />
        ))}
      </div>
    </div>
  );
}
