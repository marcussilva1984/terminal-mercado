"use client";

import { useState } from "react";
import type { MultiPeriodChange } from "@/lib/multiPeriodRanking";
import { formatPrice, changeColorClass, formatPct } from "@/lib/format";

type SortKey = "changePct1d" | "changePct7d" | "changePct30d";

const CURRENCY_BY_CLASS: Record<string, string> = { b3: "BRL", fii: "BRL", stocks: "USD", cripto: "USD", forex: "USD" };

function Cell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  return <span className={changeColorClass(value)}>{formatPct(value)}</span>;
}

export function MultiPeriodRankingTable({ items, assetClass }: { items: MultiPeriodChange[]; assetClass: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("changePct1d");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem histórico suficiente na watchlist ainda pra calcular variação multi-período.</p>;
  }

  const sorted = [...items].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const currency = CURRENCY_BY_CLASS[assetClass];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="py-1.5 pr-3">Ativo</th>
            <th className="py-1.5 pr-3 text-right">Preço</th>
            {(
              [
                ["changePct1d", "1 dia"],
                ["changePct7d", "7 dias"],
                ["changePct30d", "30 dias"],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <th
                key={key}
                onClick={() => toggleSort(key)}
                className="cursor-pointer py-1.5 pr-3 text-right select-none hover:text-text"
                title="Ordenar"
              >
                {label} {sortKey === key ? (sortDir === "desc" ? "↓" : "↑") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-3 text-text">
                {r.symbol} <span className="text-xs text-text-muted">— {r.label}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-text">{formatPrice(r.price, currency)}</td>
              <td className="py-1.5 pr-3 text-right">
                <Cell value={r.changePct1d} />
              </td>
              <td className="py-1.5 pr-3 text-right">
                <Cell value={r.changePct7d} />
              </td>
              <td className="py-1.5 text-right">
                <Cell value={r.changePct30d} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
