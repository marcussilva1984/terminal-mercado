"use client";

import { useState } from "react";
import type { AnalystTarget } from "@/lib/sources/yahooAnalyst";

function getRating(mean: number | null): { label: string; color: string } {
  if (mean === null) return { label: "—", color: "text-text-muted" };
  if (mean <= 1.5) return { label: "Compra Forte", color: "text-up" };
  if (mean <= 2.5) return { label: "Compra", color: "text-up" };
  if (mean <= 3.5) return { label: "Neutro", color: "text-gold-bright" };
  if (mean <= 4.5) return { label: "Venda", color: "text-down" };
  return { label: "Venda Forte", color: "text-down" };
}

function upsidePct(current: number | null, target: number | null): number | null {
  if (!current || !target) return null;
  return ((target - current) / current) * 100;
}

type Filter = "all" | "underrated" | "overrated";

export function AnalystRadar({ targets }: { targets: AnalystTarget[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const enriched = targets.map((t) => ({
    ...t,
    upside: upsidePct(t.currentPrice, t.targetMeanPrice),
  }));

  const filtered = enriched.filter((t) => {
    if (filter === "underrated") return t.upside !== null && t.upside >= 15;
    if (filter === "overrated") return t.upside !== null && t.upside <= -5;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => (b.upside ?? 0) - (a.upside ?? 0));

  if (targets.length === 0) {
    return <p className="text-sm text-text-muted">Sem dados de analistas disponíveis no momento.</p>;
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "underrated", "overrated"] as Filter[]).map((f) => {
          const labels: Record<Filter, string> = {
            all: "Todos",
            underrated: "Upside ≥ 15% (Underrated)",
            overrated: "Downside ≥ 5% (Overrated)",
          };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-gold-bright text-bg"
                  : "bg-panel-alt text-text-muted hover:text-text"
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhum papel nesse filtro agora.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="pb-2 font-medium">Papel</th>
                <th className="pb-2 font-medium text-right">Atual</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Alvo baixo</th>
                <th className="pb-2 font-medium text-right">Alvo médio</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Alvo alto</th>
                <th className="pb-2 font-medium text-right">Upside</th>
                <th className="pb-2 font-medium text-center hidden md:table-cell">Range</th>
                <th className="pb-2 font-medium text-center">Consenso</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Analistas</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const rating = getRating(t.recommendationMean);
                const upside = t.upside;
                const upsideColor =
                  upside === null ? "text-text-muted" : upside >= 0 ? "text-up" : "text-down";

                // posição do preço atual no range [low, high]
                const rangePct =
                  t.targetLowPrice && t.targetHighPrice && t.currentPrice
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          ((t.currentPrice - t.targetLowPrice) /
                            (t.targetHighPrice - t.targetLowPrice)) *
                            100
                        )
                      )
                    : null;

                return (
                  <tr key={t.symbol} className="border-b border-border/40 last:border-0 hover:bg-panel-alt/40">
                    <td className="py-2.5 font-medium text-text">
                      <a href={`/ticker/${t.symbol.replace(".SA", "")}?class=b3`} className="hover:text-gold-bright hover:underline">
                        {t.symbol.replace(".SA", "")}
                      </a>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-text">
                      {t.currentPrice != null ? `R$ ${t.currentPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-text-muted hidden sm:table-cell">
                      {t.targetLowPrice != null ? `R$ ${t.targetLowPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-text font-medium">
                      {t.targetMeanPrice != null ? `R$ ${t.targetMeanPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-text-muted hidden sm:table-cell">
                      {t.targetHighPrice != null ? `R$ ${t.targetHighPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className={`py-2.5 text-right tabular-nums font-semibold ${upsideColor}`}>
                      {upside != null ? `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2.5 hidden md:table-cell px-3">
                      {rangePct != null ? (
                        <div className="relative h-2 w-24 rounded-full bg-border">
                          {/* barra de range verde */}
                          <div className="absolute inset-0 rounded-full bg-up/20" />
                          {/* marcador do preço atual */}
                          <div
                            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-bg bg-gold-bright"
                            style={{ left: `calc(${rangePct}% - 6px)` }}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className={`py-2.5 text-center text-xs font-medium ${rating.color}`}>
                      {rating.label}
                    </td>
                    <td className="py-2.5 text-right text-xs text-text-muted hidden sm:table-cell">
                      {t.numberOfAnalysts ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-text-muted">
        Preço-alvo e consenso via Yahoo Finance (analistas do sell-side). Upside = distância ao alvo médio. Atualizado a cada hora.
      </p>
    </div>
  );
}
