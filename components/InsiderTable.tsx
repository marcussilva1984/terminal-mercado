import { formatNumber } from "@/lib/format";
import type { InsiderTransaction } from "@/lib/sources/secInsiders";

export function InsiderTable({ items }: { items: InsiderTransaction[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem transações de insider (compra/venda em mercado aberto) recentes.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="pb-2 font-medium">Ativo</th>
            <th className="pb-2 font-medium">Insider</th>
            <th className="pb-2 font-medium">Data</th>
            <th className="pb-2 font-medium">Ação</th>
            <th className="pb-2 font-medium text-right">Ações</th>
            <th className="pb-2 font-medium text-right">Preço</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-2">
                <a href={t.filingUrl} target="_blank" rel="noreferrer" className="font-medium text-gold-bright hover:underline">
                  {t.symbol}
                </a>
              </td>
              <td className="py-2">
                <div className="text-text">{t.ownerName}</div>
                <div className="text-xs text-text-muted">{t.relationship}</div>
              </td>
              <td className="py-2 text-text-muted">{new Date(t.transactionDate).toLocaleDateString("pt-BR")}</td>
              <td className={`py-2 font-medium ${t.transactionCode === "P" ? "text-up" : "text-down"}`}>
                {t.transactionCode === "P" ? "Compra" : "Venda"}
              </td>
              <td className="py-2 text-right text-text">{t.shares !== null ? formatNumber(t.shares, 0) : "—"}</td>
              <td className="py-2 text-right text-text">
                {t.pricePerShare !== null && t.pricePerShare > 0 ? `US$ ${formatNumber(t.pricePerShare)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Via SEC EDGAR (Form 4, dados oficiais e gratuitos). Só mostra compra/venda discricionária em mercado
        aberto — exclui exercício de opções, doações e planos automáticos 10b5-1. Compra de insider (executivo
        ou diretor comprando com o próprio dinheiro) é historicamente um sinal mais forte que venda (que pode
        ser só diversificação).
      </p>
    </div>
  );
}
