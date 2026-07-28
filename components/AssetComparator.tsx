"use client";

import { useState } from "react";
import { formatNumber, formatCompact, changeColorClass, formatPct } from "@/lib/format";
import type { TickerDetail } from "@/lib/sources/yahooTickerDetail";

const CLASS_OPTIONS = [
  { value: "b3", label: "Ação B3" },
  { value: "stocks", label: "Stock (EUA)" },
  { value: "fii", label: "FII" },
  { value: "cripto", label: "Cripto" },
];

interface Slot {
  symbol: string;
  assetClass: string;
}

interface Result {
  slot: Slot;
  currency: "BRL" | "USD";
  data: TickerDetail | null;
  error?: string;
}

function toYahooSymbol(symbol: string, assetClass: string): string {
  if (assetClass === "b3" || assetClass === "fii") return `${symbol}.SA`;
  if (assetClass === "cripto") return `${symbol}-USD`;
  return symbol;
}

const METRICS: { label: string; get: (d: TickerDetail) => string; positiveGood?: boolean }[] = [
  { label: "Preço", get: (d) => (d.price !== null ? formatNumber(d.price) : "—") },
  { label: "Variação (dia)", get: (d) => (d.changePct !== null ? formatPct(d.changePct) : "—") },
  { label: "P/L", get: (d) => (d.trailingPE !== null ? formatNumber(d.trailingPE) : "—") },
  { label: "P/VP", get: (d) => (d.priceToBook !== null ? formatNumber(d.priceToBook) : "—") },
  { label: "Div. Yield", get: (d) => (d.dividendYield !== null ? `${formatNumber(d.dividendYield)}%` : "—") },
  { label: "ROE", get: (d) => (d.returnOnEquity !== null ? `${formatNumber(d.returnOnEquity)}%` : "—") },
  { label: "Margem Líquida", get: (d) => (d.profitMargin !== null ? `${formatNumber(d.profitMargin)}%` : "—") },
  { label: "Dív./Patrim.", get: (d) => (d.debtToEquity !== null ? `${formatNumber(d.debtToEquity)}%` : "—") },
  { label: "Beta", get: (d) => (d.beta !== null ? formatNumber(d.beta) : "—") },
  { label: "Market Cap", get: (d) => (d.marketCap !== null ? formatCompact(d.marketCap, "") : "—") },
  {
    label: "Preço-Alvo Médio",
    get: (d) => (d.targetMeanPrice !== null ? formatNumber(d.targetMeanPrice) : "—"),
  },
  { label: "Free Float", get: (d) => (d.freeFloatPct !== null ? `${formatNumber(d.freeFloatPct)}%` : "—") },
];

export function AssetComparator() {
  const [slots, setSlots] = useState<Slot[]>([
    { symbol: "", assetClass: "b3" },
    { symbol: "", assetClass: "b3" },
    { symbol: "", assetClass: "b3" },
  ]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  function updateSlot(i: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    const activeSlots = slots.filter((s) => s.symbol.trim());
    if (activeSlots.length < 2) return;

    setLoading(true);
    const fetched = await Promise.all(
      activeSlots.map(async (slot) => {
        const yahooSymbol = toYahooSymbol(slot.symbol.trim().toUpperCase(), slot.assetClass);
        const currency: "BRL" | "USD" = slot.assetClass === "b3" || slot.assetClass === "fii" ? "BRL" : "USD";
        try {
          const res = await fetch(`/api/ticker-detail?symbol=${encodeURIComponent(yahooSymbol)}`, { cache: "no-store" });
          const json = await res.json();
          return { slot: { ...slot, symbol: slot.symbol.trim().toUpperCase() }, currency, data: json.available ? json.data : null, error: json.error };
        } catch (err) {
          return { slot: { ...slot, symbol: slot.symbol.trim().toUpperCase() }, currency, data: null, error: err instanceof Error ? err.message : "Falha" };
        }
      })
    );
    setResults(fetched);
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCompare} className="flex flex-wrap gap-3">
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-2 rounded border border-border bg-panel-alt px-2 py-1.5">
            <input
              value={slot.symbol}
              onChange={(e) => updateSlot(i, { symbol: e.target.value })}
              placeholder={`Ativo ${i + 1}`}
              className="w-28 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
            />
            <select
              value={slot.assetClass}
              onChange={(e) => updateSlot(i, { assetClass: e.target.value })}
              className="bg-transparent text-xs text-text-muted outline-none"
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c.value} value={c.value} className="bg-panel-alt text-text">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="rounded border border-gold/40 bg-panel-alt px-4 py-1.5 text-sm text-gold-bright hover:bg-panel disabled:opacity-50"
        >
          {loading ? "Comparando..." : "Comparar"}
        </button>
      </form>

      {results && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="pb-2 font-medium">Indicador</th>
                {results.map((r, i) => (
                  <th key={i} className="pb-2 pl-4 font-medium text-text">
                    {r.data ? r.slot.symbol : `${r.slot.symbol} (indisponível)`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.label} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 text-text-muted">{m.label}</td>
                  {results.map((r, i) => (
                    <td
                      key={i}
                      className={`py-1.5 pl-4 ${
                        m.label === "Variação (dia)" && r.data?.changePct !== null && r.data
                          ? changeColorClass(r.data.changePct as number)
                          : "text-text"
                      }`}
                    >
                      {r.data
                        ? m.label === "Market Cap"
                          ? formatCompact(r.data.marketCap ?? 0, r.currency === "BRL" ? "R$" : "US$")
                          : m.label === "Preço" && r.data.price !== null
                            ? `${r.currency === "BRL" ? "R$" : "US$"} ${formatNumber(r.data.price)}`
                            : m.label === "Preço-Alvo Médio" && r.data.targetMeanPrice !== null
                              ? `${r.currency === "BRL" ? "R$" : "US$"} ${formatNumber(r.data.targetMeanPrice)}`
                              : m.get(r.data)
                        : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
