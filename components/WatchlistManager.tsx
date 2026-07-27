"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "@/components/Panel";

interface WatchlistItem {
  id: number;
  symbol: string;
  assetClass: string;
  label: string;
}

const ASSET_CLASS_LABEL: Record<string, string> = {
  b3: "Ação B3",
  cripto: "Cripto",
};

export function WatchlistManager() {
  const [items, setItems] = useState<WatchlistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "", assetClass: "b3", label: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const json = await res.json();
      if (json.available) setItems(json.data);
      else setError(json.error ?? "Falha ao carregar watchlist");
    } catch {
      setError("Falha ao carregar watchlist");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount, no alternative data source
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: form.symbol,
        assetClass: form.assetClass,
        label: form.label || form.symbol,
      }),
    });
    setForm({ symbol: "", assetClass: "b3", label: "" });
    setSubmitting(false);
    load();
  }

  async function handleRemove(id: number) {
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    load();
  }

  if (error) {
    return (
      <Panel title="Watchlist (Z-Score / Volatilidade)">
        <p className="text-sm text-text-muted">
          Configure <code>DATABASE_URL</code> para habilitar a watchlist editável. ({error})
        </p>
      </Panel>
    );
  }

  const b3Items = items?.filter((i) => i.assetClass === "b3") ?? [];
  const criptoItems = items?.filter((i) => i.assetClass === "cripto") ?? [];

  return (
    <Panel title="Watchlist (Z-Score / Volatilidade)">
      <p className="mb-4 text-sm text-text-muted">
        Papéis/moedas aqui têm o preço coletado diariamente pelo cron e alimentam os painéis de
        z-score e volatilidade. Para B3, sem um <code>BRAPI_TOKEN</code> gratuito da brapi.dev,
        só PETR4/VALE3/MGLU3/ITUB4 têm histórico coletável — adicionar outro papel sem token não
        vai funcionar.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase text-text-muted">B3</h3>
          <ul className="flex flex-col divide-y divide-border/50">
            {b3Items.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-text">
                  {i.symbol} <span className="text-text-muted">— {i.label}</span>
                </span>
                <button onClick={() => handleRemove(i.id)} className="text-xs text-down hover:underline">
                  remover
                </button>
              </li>
            ))}
            {b3Items.length === 0 && <li className="py-2 text-sm text-text-muted">Nenhum papel na watchlist.</li>}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase text-text-muted">Cripto</h3>
          <ul className="flex flex-col divide-y divide-border/50">
            {criptoItems.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-text">
                  {i.symbol} <span className="text-text-muted">— {i.label}</span>
                </span>
                <button onClick={() => handleRemove(i.id)} className="text-xs text-down hover:underline">
                  remover
                </button>
              </li>
            ))}
            {criptoItems.length === 0 && <li className="py-2 text-sm text-text-muted">Nenhuma moeda na watchlist.</li>}
          </ul>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mt-6 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Símbolo</label>
          <input
            required
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="WEGE3 ou ETH"
            className="w-32 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Classe</label>
          <select
            value={form.assetClass}
            onChange={(e) => setForm({ ...form, assetClass: e.target.value })}
            className="rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
          >
            <option value="b3">Ação B3</option>
            <option value="cripto">Cripto</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Nome (opcional)</label>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="WEG ON"
            className="w-40 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
        >
          Adicionar
        </button>
      </form>
    </Panel>
  );
}
