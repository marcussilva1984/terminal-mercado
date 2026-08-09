"use client";

import { useState } from "react";
import { Panel } from "@/components/Panel";
import { RankingTable, type ValueFormat } from "@/components/RankingTable";
import type { RankingItem } from "@/lib/types";

const COUNT_OPTIONS = [5, 10, 20] as const;

export type { ValueFormat };

export function RankingPanel({
  title,
  items,
  updatedAt,
  valueLabel,
  format = "number",
  defaultCount = 10,
  assetClass,
}: {
  title: string;
  items: RankingItem[];
  updatedAt?: string;
  valueLabel?: string;
  format?: ValueFormat;
  defaultCount?: (typeof COUNT_OPTIONS)[number];
  assetClass?: "b3" | "cripto" | "stocks" | "fii";
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
      <RankingTable items={items.slice(0, count)} valueLabel={valueLabel} format={format} assetClass={assetClass} />
    </Panel>
  );
}
