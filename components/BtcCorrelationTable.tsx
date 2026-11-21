"use client";

import { useState } from "react";
import type { BtcCorrelation } from "@/lib/btcCorrelation";

function corrColor(c: number): string {
  if (c >= 0.8) return "text-text-muted";   // anda junto — sem destaque
  if (c >= 0.5) return "text-amber-400";
  if (c >= 0) return "text-purple-400";
  return "text-cyan-400";                    // descorrelacionado ou inverso
}

function corrLabel(c: number): string {
  if (c >= 0.8) return "junto";
  if (c >= 0.5) return "parcial";
  if (c >= 0) return "fraco";
  return "inverso";
}

export function BtcCorrelationTable({ items }: { items: BtcCorrelation[] }) {
  const [sort, setSort] = useState<"corr" | "perf">("corr");

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Histórico insuficiente — aguarde o cron coletar pelo menos 5 dias de dados para a watchlist.
      </p>
    );
  }

  const sorted = [...items].sort((a, b) =>
    sort === "corr"
      ? a.correlation30d - b.correlation30d  // menos correlacionado primeiro
      : (b.selfChange30d - a.selfChange30d * (b.btcChange30d / (a.btcChange30d || 1))) // alts que divergiram mais
  );

  const btcChange = items[0]?.btcChange30d ?? 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">BTC 30d: <span className={btcChange >= 0 ? "text-up font-semibold" : "text-down font-semibold"}>{btcChange >= 0 ? "+" : ""}{btcChange.toFixed(1)}%</span></span>
        <div className="flex gap-0.5 rounded border border-border p-0.5 text-xs">
          <button onClick={() => setSort("corr")} className={`rounded px-2 py-0.5 ${sort === "corr" ? "bg-panel-alt text-gold-bright" : "text-text-muted"}`}>
            Correlação
          </button>
          <button onClick={() => setSort("perf")} className={`rounded px-2 py-0.5 ${sort === "perf" ? "bg-panel-alt text-gold-bright" : "text-text-muted"}`}>
            Desempenho
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="pb-1.5 text-left font-normal">Ativo</th>
              <th className="pb-1.5 text-right font-normal">Corr. 30d</th>
              <th className="pb-1.5 text-right font-normal">Alt 30d</th>
              <th className="pb-1.5 text-right font-normal">BTC 30d</th>
              <th className="pb-1.5 text-right font-normal">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.symbol} className="border-b border-border/30 last:border-0">
                <td className="py-1.5 font-medium text-text">{r.symbol}</td>
                <td className={`py-1.5 text-right tabular-nums font-semibold ${corrColor(r.correlation30d)}`}>
                  {r.correlation30d.toFixed(2)}
                </td>
                <td className={`py-1.5 text-right tabular-nums ${r.selfChange30d >= 0 ? "text-up" : "text-down"}`}>
                  {r.selfChange30d >= 0 ? "+" : ""}{r.selfChange30d.toFixed(1)}%
                </td>
                <td className={`py-1.5 text-right tabular-nums ${r.btcChange30d >= 0 ? "text-up" : "text-down"}`}>
                  {r.btcChange30d >= 0 ? "+" : ""}{r.btcChange30d.toFixed(1)}%
                </td>
                <td className={`py-1.5 text-right ${corrColor(r.correlation30d)}`}>{corrLabel(r.correlation30d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Correlação de Pearson nos retornos diários dos últimos 30 dias. &quot;inverso&quot; = se move contra o BTC — pode ser hedge ou movimento próprio.
      </p>
    </div>
  );
}
