import { formatNumber } from "@/lib/format";
import type { MajorShareholder, InsiderFlowMonth } from "@/lib/sources/fundamentus";

export function ShareholdersTable({ items }: { items: MajorShareholder[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem dados de acionistas disponíveis.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {items.map((s) => (
        <li key={s.name} className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-text">{s.name}</span>
          <span className="font-medium text-gold-bright">{formatNumber(s.percentage)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function InsiderFlowTable({ items }: { items: InsiderFlowMonth[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem dados de movimentação de insiders.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="pb-2 font-medium">Mês</th>
            <th className="pb-2 font-medium text-right">Qtd. líquida</th>
            <th className="pb-2 font-medium text-right">Valor (R$)</th>
            <th className="pb-2 font-medium text-right">Preço médio</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.date} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 text-text-muted">
                {new Date(m.date).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
              </td>
              <td className={`py-1.5 text-right font-medium ${m.quantity >= 0 ? "text-up" : "text-down"}`}>
                {m.quantity >= 0 ? "+" : ""}
                {formatNumber(m.quantity, 0)}
              </td>
              <td className={`py-1.5 text-right ${m.valueBRL >= 0 ? "text-up" : "text-down"}`}>
                R$ {formatNumber(m.valueBRL, 0)}
              </td>
              <td className="py-1.5 text-right text-text">{m.avgPrice > 0 ? `R$ ${formatNumber(m.avgPrice)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Via Fundamentus.com.br. Fluxo líquido MENSAL agregado da empresa (soma de todas as movimentações de
        insiders no mês) — diferente do painel de Stocks (EUA), que mostra transação individual por pessoa.
      </p>
    </div>
  );
}
