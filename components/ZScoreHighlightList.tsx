"use client";

import { useState } from "react";
import type { ZScoreHighlight } from "@/lib/types";
import { formatPct } from "@/lib/format";

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
                <th className="pb-1 text-right font-normal">MA200</th>
                <th className="pb-1 text-right font-normal">Sinais</th>
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
                  <td className="py-1 pl-2 text-right text-xs tabular-nums">
                    {z.aboveMA200 !== undefined ? (
                      <span className={z.aboveMA200 ? "text-up" : "text-down"}>
                        {z.aboveMA200 ? "▲" : "▼"}{z.ma200DistPct !== undefined ? ` ${Math.abs(z.ma200DistPct).toFixed(1)}%` : ""}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-1 pl-1 text-right whitespace-nowrap">
                    {z.cipherSignal === "compra" && <span className="text-[9px] font-bold text-up">▲C</span>}
                    {z.cipherSignal === "venda" && <span className="text-[9px] font-bold text-down">▼C</span>}
                    {z.cipherOversold && <span className="text-[9px] text-cyan-400 ml-0.5">OS</span>}
                    {z.cipherOverbought && <span className="text-[9px] text-orange-400 ml-0.5">OB</span>}
                    {z.obvSignal === "diverge" && <span className="text-[9px] text-purple-400 ml-0.5" title="OBV divergência">OBV!</span>}
                    {z.obvSignal === "confirma" && z.obvTrend === "alta" && <span className="text-[9px] text-up/70 ml-0.5" title="OBV confirmando alta">▲V</span>}
                    {z.obvSignal === "confirma" && z.obvTrend === "baixa" && <span className="text-[9px] text-down/70 ml-0.5" title="OBV confirmando baixa">▼V</span>}
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
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${heatCell(z.changePct)}`}>{formatPct(z.changePct)}</span>
                {z.aboveMA200 !== undefined && (
                  <span className={`text-[10px] ${z.aboveMA200 ? "text-up" : "text-down"}`} title={`${z.aboveMA200 ? "Acima" : "Abaixo"} da MA200`}>
                    {z.aboveMA200 ? "▲" : "▼"}MA
                  </span>
                )}
                {z.cipherSignal === "compra" && <span className="text-[9px] font-bold text-up" title="Cipher B compra">▲C</span>}
                {z.cipherSignal === "venda" && <span className="text-[9px] font-bold text-down" title="Cipher B venda">▼C</span>}
                {z.cipherOversold && <span className="text-[9px] text-cyan-400" title="WaveTrend sobrevendido">OS</span>}
                {z.cipherOverbought && <span className="text-[9px] text-orange-400" title="WaveTrend sobrecomprado">OB</span>}
                {z.obvSignal === "diverge" && <span className="text-[9px] text-purple-400" title="OBV divergência volume/preço">OBV!</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
