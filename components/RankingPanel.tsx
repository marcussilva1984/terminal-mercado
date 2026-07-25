"use client";

import { useState } from "react";
import { Panel } from "@/components/Panel";
import { RankingTable } from "@/components/RankingTable";
import { formatNumber, formatPrice, formatUSDCompact } from "@/lib/format";
import type { RankingItem } from "@/lib/types";

const COUNT_OPTIONS = [5, 10, 20] as const;

export type ValueFormat = "number" | "price-usd" | "price-brl" | "compact-usd";

const FORMATTERS: Record<ValueFormat, (value: number) => string> = {
  number: (v) => formatNumber(v),
  "price-usd": (v) => formatPrice(v, "USD"),
  "price-brl": (v) => formatPrice(v, "BRL"),
  "compact-usd": formatUSDCompact,
};

export function RankingPanel({
  title,
  items,
  updatedAt,
  valueLabel,
  format = "number",
  defaultCount = 10,
}: {
  title: string;
  items: RankingItem[];
  updatedAt?: string;
  valueLabel?: string;
  format?: ValueFormat;
  defaultCount?: (typeof COUNT_OPTIONS)[number];
}) {
  const [count, setCount] = useState<number>(defaultCount);

  return (
    <Panel
      title={title}
      updatedAt={updatedAt}
      action={
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="rounded border border-border bg-panel-alt px-1.5 py-0.5 text-xs text-text"
        >
          {COUNT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              Top {opt}
            </option>
          ))}
        </select>
      }
    >
      <RankingTable items={items.slice(0, count)} valueLabel={valueLabel} formatValue={FORMATTERS[format]} />
    </Panel>
  );
}
