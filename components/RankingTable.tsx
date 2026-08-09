"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RankingItem } from "@/lib/types";
import { changeColorClass, formatNumber, formatPct, formatPrice, formatUSDCompact } from "@/lib/format";

type SortKey = "symbol" | "price" | "value" | "changePct" | "volume";
type SortDirection = "asc" | "desc";

function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none pb-2 font-medium hover:text-text ${align === "right" ? "text-right" : "text-left"}`}
    >
      {label}
      {active && <span className="ml-1 text-gold-bright">{direction === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

// "format" é serializável (string) de propósito — uma função não pode
// atravessar a fronteira Server -> Client Component (React derruba a página
// inteira com "Functions cannot be passed directly to Client Components").
export type ValueFormat = "number" | "percent-of-1" | "price-usd" | "price-brl" | "compact-usd";

function applyFormat(value: number, format: ValueFormat): string {
  switch (format) {
    case "percent-of-1":
      return `${(value * 100).toFixed(1)}%`;
    case "price-usd":
      return formatPrice(value, "USD");
    case "price-brl":
      return formatPrice(value, "BRL");
    case "compact-usd":
      return formatUSDCompact(value);
    default:
      return formatNumber(value);
  }
}

export function RankingTable({
  items,
  valueLabel = "Preço",
  format = "number",
  assetClass,
}: {
  items: RankingItem[];
  valueLabel?: string;
  format?: ValueFormat;
  assetClass?: "b3" | "cripto" | "stocks" | "fii";
}) {
  const [sortKey, setSortKey] = useState<SortKey>("changePct");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const hasPrice = items[0]?.price !== undefined;
  const hasVolume = items[0]?.volume !== undefined;

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let diff = 0;
      if (sortKey === "symbol") diff = a.symbol.localeCompare(b.symbol);
      else if (sortKey === "price") diff = (a.price ?? 0) - (b.price ?? 0);
      else if (sortKey === "value") diff = a.value - b.value;
      else if (sortKey === "changePct") diff = a.changePct - b.changePct;
      else if (sortKey === "volume") diff = (a.volume ?? 0) - (b.volume ?? 0);
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados disponíveis.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-text-muted">
          <SortHeader label="Ativo" align="left" active={sortKey === "symbol"} direction={sortDir} onClick={() => handleSort("symbol")} />
          {hasPrice && (
            <SortHeader label="Preço" active={sortKey === "price"} direction={sortDir} onClick={() => handleSort("price")} />
          )}
          <SortHeader label={valueLabel} active={sortKey === "value"} direction={sortDir} onClick={() => handleSort("value")} />
          <SortHeader label="Var. %" active={sortKey === "changePct"} direction={sortDir} onClick={() => handleSort("changePct")} />
          {hasVolume && (
            <SortHeader label="Volume" active={sortKey === "volume"} direction={sortDir} onClick={() => handleSort("volume")} />
          )}
        </tr>
      </thead>
      <tbody>
        {sorted.map((item) => (
          <tr key={item.symbol} className="border-b border-border/50 last:border-0">
            <td className="py-2">
              {assetClass ? (
                <Link href={`/ticker/${item.symbol}?class=${assetClass}`} className="hover:underline">
                  <div className="font-medium text-gold-bright">{item.symbol}</div>
                  <div className="text-xs text-text-muted">{item.label}</div>
                </Link>
              ) : (
                <>
                  <div className="font-medium text-text">{item.symbol}</div>
                  <div className="text-xs text-text-muted">{item.label}</div>
                </>
              )}
            </td>
            {item.price !== undefined && <td className="py-2 text-right text-text-muted">{formatPrice(item.price, "USD")}</td>}
            <td className="py-2 text-right text-text">{applyFormat(item.value, format)}</td>
            <td className={`py-2 text-right ${changeColorClass(item.changePct)}`}>
              {formatPct(item.changePct)}
            </td>
            {item.volume !== undefined && (
              <td className="py-2 text-right text-text-muted">{formatNumber(item.volume, 0)}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
