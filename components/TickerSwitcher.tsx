"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CLASS_OPTIONS = [
  { value: "b3", label: "Ação B3" },
  { value: "stocks", label: "Stock (EUA)" },
  { value: "fii", label: "FII" },
  { value: "cripto", label: "Cripto" },
];

export function TickerSwitcher({ defaultClass }: { defaultClass: string }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [assetClass, setAssetClass] = useState(defaultClass);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) return;
    router.push(`/ticker/${symbol.trim().toUpperCase()}?class=${assetClass}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="Buscar ativo (ex: VALE3, AAPL)"
        className="w-48 rounded border border-border bg-panel-alt px-2 py-1.5 text-sm text-text"
      />
      <select
        value={assetClass}
        onChange={(e) => setAssetClass(e.target.value)}
        className="rounded border border-border bg-panel-alt px-2 py-1.5 text-sm text-text"
      >
        {CLASS_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
      >
        Ir
      </button>
    </form>
  );
}
