import { formatPct, changeColorClass } from "@/lib/format";
import type { VolatilityResult } from "@/lib/volatility";

export function VolatilityTable({ items }: { items: VolatilityResult[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Sem histórico suficiente ainda — precisa de alguns dias de coleta via cron para calcular.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="pb-2 font-medium">Papel</th>
            <th className="pb-2 font-medium text-right">Var. último pregão</th>
            <th className="pb-2 font-medium text-right">Volatilidade 1sem</th>
            <th className="pb-2 font-medium text-right">Volatilidade 1mês</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.symbol} className="border-t border-border">
              <td className="py-1.5 font-medium text-text">{v.symbol}</td>
              <td className={`py-1.5 text-right ${changeColorClass(v.lastChangePct)}`}>{formatPct(v.lastChangePct)}</td>
              <td className="py-1.5 text-right text-text">{v.vol1w.toFixed(2)}%</td>
              <td className="py-1.5 text-right text-gold-bright">{v.vol1m.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Volatilidade = desvio-padrão dos retornos diários (proxy de risco/oscilação, calculado a
        partir do histórico coletado). Não é short interest nem alavancagem financeira oficial —
        essas fontes não existem gratuitas para o mercado brasileiro. Limitado aos 4 papéis livres
        da brapi.dev (PETR4, VALE3, MGLU3, ITUB4); com um token gratuito da brapi.dev dá pra
        expandir para o mercado inteiro.
      </p>
    </div>
  );
}
