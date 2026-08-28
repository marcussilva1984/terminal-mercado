"use client";

import { useState } from "react";
import type { NewsItem } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { getNewsPriority } from "@/lib/sentiment";
import { getMediaBias } from "@/lib/mediaBias";

const BIAS_CLASS: Record<string, string> = {
  Esquerda: "text-down",
  "Centro-Esquerda": "text-down/70",
  Centro: "text-text-muted",
  "Centro-Direita": "text-gold-bright/70",
  Direita: "text-gold-bright",
};

const PRIORITY_BADGE: Record<"alta" | "media", { label: string; badgeClass: string; textClass: string }> = {
  alta: {
    label: "Alta Prioridade",
    badgeClass: "border-down/40 bg-down/10 text-down",
    textClass: "font-semibold text-down",
  },
  media: {
    label: "Média Prioridade",
    badgeClass: "border-amber/40 bg-amber/10 text-amber",
    textClass: "font-medium text-amber",
  },
};

function matchesWatchlist(title: string, symbols: string[]): string | null {
  const upperTitle = title.toUpperCase();
  for (const symbol of symbols) {
    const re = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(upperTitle)) return symbol;
  }
  return null;
}

export function NewsFeed({ items, now, watchlistSymbols }: { items: NewsItem[]; now: string; watchlistSymbols?: string[] }) {
  const [count, setCount] = useState(Math.min(10, items.length));

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem notícias no momento.</p>;
  }

  const nowMs = new Date(now).getTime();
  const isRecent = (iso: string) => nowMs - new Date(iso).getTime() < 15 * 60 * 1000;

  return (
    <div>
      {items.length > 3 && (
        <div className="mb-2 flex items-center justify-end gap-2">
          <span className="text-xs text-text-muted">Mostrar</span>
          <input
            type="number"
            min={3}
            max={items.length}
            value={count}
            onChange={(e) => setCount(Math.max(3, Math.min(items.length, Number(e.target.value) || 10)))}
            className="w-14 rounded border border-border bg-panel-alt px-1.5 py-0.5 text-xs text-text"
          />
        </div>
      )}
      <ul className="flex flex-col divide-y divide-border/50">
        {items.slice(0, count).map((item, i) => {
        const priority = getNewsPriority(item.title);
        const badge = priority !== "baixa" ? PRIORITY_BADGE[priority] : null;
        const watchlistMatch = watchlistSymbols && watchlistSymbols.length > 0 ? matchesWatchlist(item.title, watchlistSymbols) : null;
        const bias = getMediaBias(item.source);
        return (
          <li key={`${item.url}-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="mt-1 shrink-0 text-xs tabular-nums text-text-muted">
              {formatTime(item.publishedAt)}
            </span>
            <div className="min-w-0">
              {watchlistMatch && (
                <span className="mr-1.5 inline-block rounded border border-gold/40 bg-gold/10 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-bright align-middle">
                  Na Watchlist ({watchlistMatch})
                </span>
              )}
              {badge && (
                <span
                  className={`mr-1.5 inline-block rounded border px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle ${badge.badgeClass}`}
                >
                  {badge.label}
                </span>
              )}
              <a
                href={item.url}
                className={`text-sm leading-snug hover:underline ${
                  badge ? badge.textClass : isRecent(item.publishedAt) ? "text-gold-bright" : "text-text"
                }`}
              >
                {item.title}
              </a>
              <div className="mt-0.5 text-xs text-text-muted">
                {item.source}
                {bias && <span className={`ml-1.5 ${BIAS_CLASS[bias]}`}>· {bias}</span>}
              </div>
            </div>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
