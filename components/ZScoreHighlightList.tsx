"use client";

import { useState } from "react";
import type { ZScoreHighlight } from "@/lib/types";
import { formatPct } from "@/lib/format";
import { ZScoreBadge } from "@/components/ZScoreBadge";

// Ideia 5: célula pintada pela intensidade do movimento
function heatCell(pct: number | undefined): string {
  if (pct === undefined) return "text-text-muted";
  const abs = Math.abs(pct);
  if (abs >= 10) return pct > 0 ? "bg-up text-white font-bold" : "bg-down text-white font-bold";
  if (abs >= 5)  return pct > 0 ? "bg-up/60 text-up font-semibold" : "bg-down/60 text-down font-semibold";
  if (abs >= 2)  return pct > 0 ? "bg-up/25 text-up" : "bg-down/25 text-down";
  if (abs >= 0.5) return pct > 0 ? "text-up" : "text-down";
  return "text-text-muted";
}

export function ZScoreHighlightList({ items }: { items: ZScoreHighlight[] }) {
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<"lista" | "mapa">("lista");

  const hasMulti = items.some((z) => z.change7d !== undefined);

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados disponíveis.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          Baseado na Watchlist — adicione em{" "}
          <a href="/watchlist" className="text-gold-bright hover:underline">Watchlist</a>.
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {hasMulti && (
            <div className="flex gap-0.5 rounded border border-border p-0.5 text-xs">
              <button
                onClick={() => setMode("lista")}
                className={`rounded px-2 py-0.5 ${mode === "lista" ? "bg-panel-alt text-gold-bright" : "text-text-muted"}`}
              >
                Lista
              </button>
              <button
                onClick={() => setMode("mapa")}
                className={`rounded px-2 py-0.5 ${mode === "mapa" ? "bg-panel-alt text-gold-bright" : "text-text-muted"}`}
              >
                Mapa de Calor
              </button>
            </div>
          )}
          {items.length > 5 && (
            <input
              type="number"
              min={10}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(10, Math.min(50, Number(e.target.value) || 10)))}
              className="w-14 rounded border border-border bg-panel-alt px-1.5 py-0.5 text-xs text-text"
            />
          )}
        </div>
      </div>

      {mode === "mapa" && hasMulti ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="pb-1 text-left font-normal">Ativo</th>
                <th className="pb-1 text-right font-normal">1d</th>
                <th className="pb-1 text-right font-normal">7d</th>
                <th className="pb-1 text-right font-normal">30d</th>
                <th className="pb-1 text-right font-normal">Z</th>
                <th className="pb-1 text-right font-normal">MACD</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, count).map((z) => (
                <tr key={`${z.assetClass}-${z.symbol}`} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-2 font-medium text-text">{z.symbol}</td>
                  <td className={`py-1 px-1 text-right tabular-nums rounded ${heatCell(z.changePct)}`}>
                    {formatPct(z.changePct)}
                  </td>
                  <td className={`py-1 px-1 text-right tabular-nums rounded ${heatCell(z.change7d)}`}>
                    {z.change7d !== undefined ? formatPct(z.change7d) : "—"}
                  </td>
                  <td className={`py-1 px-1 text-right tabular-nums rounded ${heatCell(z.change30d)}`}>
                    {z.change30d !== undefined ? formatPct(z.change30d) : "—"}
                  </td>
                  <td className="py-1 pl-2 text-right"><ZScoreBadge zScore={z.zScore} /></td>
                  <td className="py-1 pl-1 text-right">
                    {z.macdSignal === "alta" && <span className="text-[9px] font-bold text-up">▲ MACD</span>}
                    {z.macdSignal === "baixa" && <span className="text-[9px] font-bold text-down">▼ MACD</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/50">
          {items.slice(0, count).map((z) => (
            <div key={`${z.assetClass}-${z.symbol}`} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <div>
                <div className="text-sm font-medium text-text">{z.symbol}</div>
                <div className="text-xs text-text-muted">{z.label}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${heatCell(z.changePct)}`}>{formatPct(z.changePct)}</span>
                <ZScoreBadge zScore={z.zScore} />
                {z.macdSignal === "alta" && <span className="text-[9px] font-bold text-up">▲</span>}
                {z.macdSignal === "baixa" && <span className="text-[9px] font-bold text-down">▼</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
