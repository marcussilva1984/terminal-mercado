import { formatPrice, formatCompact } from "@/lib/format";
import type { GrahamResult, BazinResult, DcfResult } from "@/lib/valuation";

function marginColor(pct: number): string {
  if (pct >= 20) return "text-up";
  if (pct <= -10) return "text-down";
  return "text-text";
}

export function GrahamTable({ items, currency = "BRL" }: { items: GrahamResult[]; currency?: string }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem dados suficientes (LPA/VPA) no momento.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">Preço</th>
            <th className="py-1.5 pr-3 text-right">Valor Justo (Graham)</th>
            <th className="py-1.5 text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 text-text">
                {r.symbol} <span className="text-xs text-text-muted">— {r.label}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.price, currency)}</td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.fairValue, currency)}</td>
              <td className={`py-1.5 text-right font-medium ${marginColor(r.marginOfSafetyPct)}`}>
                {r.marginOfSafetyPct >= 0 ? "+" : ""}
                {r.marginOfSafetyPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BazinTable({ items, currency = "BRL" }: { items: BazinResult[]; currency?: string }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem histórico de dividendos suficiente no momento.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">Preço</th>
            <th className="py-1.5 pr-3 text-right">Div/Ano (12m)</th>
            <th className="py-1.5 pr-3 text-right">Preço Justo (Bazin)</th>
            <th className="py-1.5 text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 text-text">
                {r.symbol} <span className="text-xs text-text-muted">— {r.label}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.price, currency)}</td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.avgAnnualDividendPerShare, currency)}</td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.fairPrice, currency)}</td>
              <td className={`py-1.5 text-right font-medium ${marginColor(r.marginOfSafetyPct)}`}>
                {r.marginOfSafetyPct >= 0 ? "+" : ""}
                {r.marginOfSafetyPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DcfTable({ items }: { items: DcfResult[] }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Sem fluxo de caixa (CVM) disponível pra nenhum ativo agora.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">Preço</th>
            <th className="py-1.5 pr-3 text-right">FCF ({"ano"})</th>
            <th className="py-1.5 pr-3 text-right">Valor Justo (DCF)</th>
            <th className="py-1.5 text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 text-text">
                {r.symbol} <span className="text-xs text-text-muted">— {r.label}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.price, "BRL")}</td>
              <td className="py-1.5 pr-3 text-right text-text">
                {formatCompact(r.freeCashFlow, "R$")} <span className="text-xs text-text-muted">({r.fiscalYear.slice(0, 4)})</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.fairValue, "BRL")}</td>
              <td className={`py-1.5 text-right font-medium ${marginColor(r.marginOfSafetyPct)}`}>
                {r.marginOfSafetyPct >= 0 ? "+" : ""}
                {r.marginOfSafetyPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
