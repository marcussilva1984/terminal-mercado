import { formatPrice } from "@/lib/format";
import type { Sma200Result, MonteCarloResult } from "@/lib/valuation";

const CURRENCY_BY_CLASS: Record<string, string> = { b3: "BRL", fii: "BRL", stocks: "USD", cripto: "USD" };

export function Sma200Table({ items }: { items: Sma200Result[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem histórico de 200 pregões ainda pra nenhum ativo da watchlist.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">Preço</th>
            <th className="py-1.5 pr-3 text-right">SMA200</th>
            <th className="py-1.5 text-right">Distância</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={`${r.assetClass}-${r.symbol}`} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 text-text">
                {r.symbol} <span className="text-xs text-text-muted">— {r.label}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.price, CURRENCY_BY_CLASS[r.assetClass])}</td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.sma200, CURRENCY_BY_CLASS[r.assetClass])}</td>
              <td className={`py-1.5 text-right font-medium ${r.trend === "acima" ? "text-up" : "text-down"}`}>
                {r.trend === "acima" ? "▲" : "▼"} {r.distancePct >= 0 ? "+" : ""}
                {r.distancePct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonteCarloTable({ items }: { items: MonteCarloResult[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem histórico suficiente pra simular no momento.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">Preço atual</th>
            <th className="py-1.5 pr-3 text-right">Faixa (5º-95º percentil)</th>
            <th className="py-1.5 text-right">Mediana ({items[0]?.horizonDays ?? 30}d)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={`${r.assetClass}-${r.symbol}`} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 text-text">
                {r.symbol} <span className="text-xs text-text-muted">— {r.label}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.price, CURRENCY_BY_CLASS[r.assetClass])}</td>
              <td className="py-1.5 pr-3 text-right text-text">
                {formatPrice(r.p5, CURRENCY_BY_CLASS[r.assetClass])} – {formatPrice(r.p95, CURRENCY_BY_CLASS[r.assetClass])}
              </td>
              <td className="py-1.5 text-right text-text">{formatPrice(r.p50, CURRENCY_BY_CLASS[r.assetClass])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
