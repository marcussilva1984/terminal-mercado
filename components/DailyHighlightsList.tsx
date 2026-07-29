"use client";

import { useState } from "react";
import type { DailyHighlight } from "@/lib/dailyHighlights";

export function DailyHighlightsList({ items }: { items: DailyHighlight[] }) {
  const [count, setCount] = useState(Math.min(10, items.length));

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem destaques disponíveis hoje.</p>;
  }

  return (
    <div>
      {items.length > 10 && (
        <div className="mb-2 flex items-center justify-end gap-2">
          <span className="text-xs text-text-muted">Mostrar</span>
          <input
            type="number"
            min={1}
            max={items.length}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(items.length, Number(e.target.value) || 1)))}
            className="w-14 rounded border border-border bg-panel-alt px-1.5 py-0.5 text-xs text-text"
          />
        </div>
      )}
      <ul className="flex flex-col divide-y divide-border/50">
        {items.slice(0, count).map((h, i) => (
          <li key={i} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0 text-sm">
            <span className="shrink-0 rounded border border-gold/40 px-1.5 py-0.5 text-xs text-gold-bright">{h.category}</span>
            <span className="text-text">{h.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
