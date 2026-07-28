"use client";

import { useState, type ReactNode } from "react";

// Aba separada do gráfico: se a análise gráfica der problema, dá pra tirar
// só essa aba sem afetar indicadores/preço-alvo/insiders (que já funcionam bem).
export function TickerTabs({ overview, chart }: { overview: ReactNode; chart: ReactNode }) {
  const [tab, setTab] = useState<"overview" | "chart">("overview");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        <button
          onClick={() => setTab("overview")}
          className={`rounded border px-3 py-1.5 text-sm transition-colors ${
            tab === "overview" ? "border-gold bg-gold/10 text-gold-bright" : "border-border text-text-muted hover:text-text"
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setTab("chart")}
          className={`rounded border px-3 py-1.5 text-sm transition-colors ${
            tab === "chart" ? "border-gold bg-gold/10 text-gold-bright" : "border-border text-text-muted hover:text-text"
          }`}
        >
          Gráfico
        </button>
      </div>
      <div className={tab === "overview" ? "flex flex-col gap-6" : "hidden"}>{overview}</div>
      <div className={tab === "chart" ? "flex flex-col gap-6" : "hidden"}>{chart}</div>
    </div>
  );
}
