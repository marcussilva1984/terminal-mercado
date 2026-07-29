"use client";

import { useState } from "react";
import { NewsFeed } from "@/components/NewsFeed";
import type { NewsItem } from "@/lib/types";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "b3", label: "B3 / Brasil" },
  { value: "cripto", label: "Cripto" },
  { value: "internacional", label: "Internacional (mercado)" },
  { value: "forex", label: "Forex" },
  { value: "fii", label: "FII" },
  { value: "geral", label: "Geral (mundo)" },
];

export function NewsBoard({
  items,
  now,
  watchlistSymbols,
}: {
  items: (NewsItem & { category: string })[];
  now: string;
  watchlistSymbols?: string[];
}) {
  const [selected, setSelected] = useState("all");
  const filtered = selected === "all" ? items : items.filter((i) => i.category === selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setSelected(c.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selected === c.value
                ? "border-gold bg-gold/10 text-gold-bright"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <NewsFeed items={filtered} now={now} watchlistSymbols={watchlistSymbols} />
    </div>
  );
}
