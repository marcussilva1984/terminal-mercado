"use client";

import { useState } from "react";
import type { FatoRelevante } from "@/lib/sources/cvmFatosRelevantes";

export function FatosRelevantesTable({ items }: { items: FatoRelevante[] }) {
  const [count, setCount] = useState(Math.min(15, items.length));

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum fato relevante publicado recentemente.</p>;
  }

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
            onChange={(e) => setCount(Math.max(3, Math.min(items.length, Number(e.target.value) || 15)))}
            className="w-14 rounded border border-border bg-panel-alt px-1.5 py-0.5 text-xs text-text"
          />
        </div>
      )}
      <ul className="flex flex-col divide-y divide-border/50">
        {items.slice(0, count).map((f, i) => (
          <li key={i} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-text">{f.companyName}</span>
              <span className="shrink-0 text-xs text-text-muted">{new Date(f.date).toLocaleDateString("pt-BR")}</span>
            </div>
            {f.documentUrl ? (
              <a href={f.documentUrl} target="_blank" rel="noreferrer" className="text-sm text-gold-bright hover:underline">
                {f.subject}
              </a>
            ) : (
              <span className="text-sm text-text-muted">{f.subject}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
