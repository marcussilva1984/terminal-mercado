"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "@/components/Panel";
import { formatPrice, formatPct, changeColorClass } from "@/lib/format";

interface WatchlistItem {
  id: number;
  symbol: string;
  assetClass: string;
  label: string;
  price: number | null;
  changePct: number | null;
  currency: string | null;
}

const ASSET_CLASSES = [
  { value: "b3", label: "Ação B3" },
  { value: "fii", label: "FII" },
  { value: "stocks", label: "Stock (EUA)" },
  { value: "cripto", label: "Cripto" },
];

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
    // Mantém a classe selecionada (só limpa símbolo/nome) — evita que ao
    // cadastrar vários itens da mesma classe em sequência, o formulário volte
    // pra classe padrão e o usuário acabe salvando algo na classe errada.
    setForm((f) => ({ ...f, symbol: "", label: "" }));
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

  return (
    <Panel title="Watchlist (Z-Score / Volatilidade)">
      <p className="mb-4 text-sm text-text-muted">
        Ativos aqui têm o preço coletado diariamente pelo cron e alimentam os painéis de z-score
        (e, pra B3, volatilidade). Para B3, sem um <code>BRAPI_TOKEN</code> gratuito da brapi.dev,
        só PETR4/VALE3/MGLU3/ITUB4 têm histórico coletável via brapi — os demais papéis B3 usam
        Yahoo Finance, que não tem essa limitação.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {ASSET_CLASSES.map((cls) => {
          const classItems = items?.filter((i) => i.assetClass === cls.value) ?? [];
          return (
            <div key={cls.value}>
              <h3 className="mb-2 text-xs font-medium uppercase text-text-muted">{cls.label}</h3>
              <ul className="flex flex-col divide-y divide-border/50">
                {classItems.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-text">
                      {i.symbol} <span className="text-text-muted">— {i.label}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      {i.price !== null ? (
                        <span className="text-right">
                          <span className="text-text">{formatPrice(i.price, i.currency ?? undefined)}</span>{" "}
                          {i.changePct !== null && (
                            <span className={changeColorClass(i.changePct)}>{formatPct(i.changePct)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">sem preço</span>
                      )}
                      <button onClick={() => handleRemove(i.id)} className="text-xs text-down hover:underline">
                        remover
                      </button>
                    </div>
                  </li>
                ))}
                {classItems.length === 0 && (
                  <li className="py-2 text-sm text-text-muted">Nenhum ativo na watchlist.</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="mt-6 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Símbolo</label>
          <input
            required
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="WEGE3, MXRF11, AAPL ou ETH"
            className="w-40 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Classe</label>
          <select
            value={form.assetClass}
            onChange={(e) => setForm({ ...form, assetClass: e.target.value })}
            className="rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
          >
            {ASSET_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
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
