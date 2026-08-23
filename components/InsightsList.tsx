"use client";

import { useState } from "react";

export function InsightsList({ items, defaultCount = 10 }: { items: string[]; defaultCount?: number }) {
  const [count, setCount] = useState(defaultCount);

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem insights disponíveis agora.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-2">
        <span className="text-xs text-text-muted">Mostrar</span>
        <input
          type="number"
          min={3}
          max={Math.max(items.length, 3)}
          value={count}
          onChange={(e) => setCount(Math.max(3, Math.min(items.length, Number(e.target.value) || defaultCount)))}
          className="w-14 rounded border border-border bg-panel-alt px-1.5 py-0.5 text-xs text-text"
        />
      </div>
      <ul className="flex flex-col gap-2 text-sm text-text">
        {items.slice(0, count).map((insight, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-gold-bright">•</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
