import type { CryptoAssetSignal } from "@/lib/cryptoNewsSentiment";

export function CryptoSentimentPanel({ items }: { items: CryptoAssetSignal[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum ativo da watchlist com notícia de tom negativo nos últimos 7 dias.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col divide-y divide-border/50">
        {items.map((s) => (
          <li key={s.symbol} className="py-2 text-sm first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-text">{s.symbol}</span>
              <span className="rounded border border-down/40 px-1.5 py-0.5 text-xs text-down">
                {s.count} notícia{s.count > 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">"{s.sampleTitles[0]}"</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        Heurística por palavra-chave (hack, fraude, processo, colapso, liquidação forçada etc.) nas
        manchetes de cripto dos últimos 7 dias — não é análise de sentimento de verdade, é contagem
        de menções com tom de crise. Serve pra saber onde vale a pena ler a notícia inteira, não é
        veredito sobre o ativo.
      </p>
    </div>
  );
}
