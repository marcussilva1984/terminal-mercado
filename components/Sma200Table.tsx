import { formatPrice } from "@/lib/format";
import type { Sma200Result, MonteCarloResult, RsiSignal, BollingerSignal } from "@/lib/valuation";

const CURRENCY_BY_CLASS: Record<string, string> = { b3: "BRL", fii: "BRL", stocks: "USD", cripto: "USD", forex: "USD" };

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

const RSI_TONE: Record<RsiSignal["reading"], string> = {
  sobrecomprado: "text-down",
  sobrevendido: "text-up",
  neutro: "text-text",
};

export function RsiTable({ items }: { items: RsiSignal[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem histórico suficiente pra calcular RSI ainda.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">RSI ({items[0]?.period ?? 21})</th>
            <th className="py-1.5 text-right">Leitura</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={`${r.assetClass}-${r.symbol}`} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 text-text">
                {r.symbol} <span className="text-xs text-text-muted">— {r.label}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{r.value.toFixed(1)}</td>
              <td className={`py-1.5 text-right font-medium capitalize ${RSI_TONE[r.reading]}`}>{r.reading}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BollingerTable({ items }: { items: BollingerSignal[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem histórico suficiente pra calcular Bandas de Bollinger ainda.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">Preço</th>
            <th className="py-1.5 pr-3 text-right">Banda Inf. – Sup.</th>
            <th className="py-1.5 text-right">Posição</th>
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
                {formatPrice(r.lower, CURRENCY_BY_CLASS[r.assetClass])} – {formatPrice(r.upper, CURRENCY_BY_CLASS[r.assetClass])}
              </td>
              <td className={`py-1.5 text-right font-medium ${r.percentB > 1 ? "text-down" : r.percentB < 0 ? "text-up" : "text-text"}`}>
                {(r.percentB * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
