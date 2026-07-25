"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "@/components/Panel";
import { PieChart, type PieSlice } from "@/components/PieChart";
import { formatNumber, formatPct, changeColorClass } from "@/lib/format";

interface Holding {
  id: number;
  symbol: string;
  assetClass: string;
  label: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  currency: string | null;
}

interface PriceAlert {
  id: number;
  symbol: string;
  assetClass: string;
  label: string;
  direction: string;
  targetPrice: number;
}

const ASSET_CLASS_LABEL: Record<string, string> = {
  b3: "Ação B3",
  fii: "FII",
  cripto: "Cripto",
  stocks: "Stock (EUA)",
};

export function PortfolioManager() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "", assetClass: "b3", quantity: "", avgPrice: "" });
  const [alertForm, setAlertForm] = useState({ symbol: "", assetClass: "b3", direction: "above", targetPrice: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [hRes, aRes] = await Promise.all([fetch("/api/portfolio"), fetch("/api/portfolio/alerts")]);
      const hJson = await hRes.json();
      const aJson = await aRes.json();
      if (hJson.available) setHoldings(hJson.data);
      else setError(hJson.error ?? "Falha ao carregar carteira");
      if (aJson.available) setAlerts(aJson.data);
    } catch {
      setError("Falha ao carregar carteira");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount, no alternative data source
    load();
  }, [load]);

  async function handleAddHolding(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: form.symbol,
        assetClass: form.assetClass,
        label: form.symbol,
        quantity: parseFloat(form.quantity),
        avgPrice: parseFloat(form.avgPrice),
      }),
    });
    setForm({ symbol: "", assetClass: "b3", quantity: "", avgPrice: "" });
    setSubmitting(false);
    load();
  }

  async function handleRemoveHolding(id: number) {
    await fetch(`/api/portfolio?id=${id}`, { method: "DELETE" });
    load();
  }

  async function handleAddAlert(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/portfolio/alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: alertForm.symbol,
        assetClass: alertForm.assetClass,
        label: alertForm.symbol,
        direction: alertForm.direction,
        targetPrice: parseFloat(alertForm.targetPrice),
      }),
    });
    setAlertForm({ symbol: "", assetClass: "b3", direction: "above", targetPrice: "" });
    setSubmitting(false);
    load();
  }

  async function handleRemoveAlert(id: number) {
    await fetch(`/api/portfolio/alerts?id=${id}`, { method: "DELETE" });
    load();
  }

  const byAsset: PieSlice[] =
    holdings?.filter((h) => h.currentValue !== null).map((h) => ({ label: h.symbol, value: h.currentValue! })) ?? [];

  const byClassMap = new Map<string, number>();
  holdings?.forEach((h) => {
    if (h.currentValue === null) return;
    byClassMap.set(h.assetClass, (byClassMap.get(h.assetClass) ?? 0) + h.currentValue);
  });
  const byClass: PieSlice[] = Array.from(byClassMap.entries()).map(([k, v]) => ({
    label: ASSET_CLASS_LABEL[k] ?? k,
    value: v,
  }));

  if (error) {
    return (
      <Panel title="Minha Carteira">
        <p className="text-sm text-text-muted">
          Configure <code>DATABASE_URL</code> para habilitar a carteira. ({error})
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Alocação por Ativo">
          <PieChart slices={byAsset} />
        </Panel>
        <Panel title="Alocação por Classe">
          <PieChart slices={byClass} />
        </Panel>
      </div>

      <Panel title="Posições">
        {holdings && holdings.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="pb-2 font-medium">Ativo</th>
                <th className="pb-2 font-medium text-right">Qtd.</th>
                <th className="pb-2 font-medium text-right">Preço médio</th>
                <th className="pb-2 font-medium text-right">Preço atual</th>
                <th className="pb-2 font-medium text-right">P&L</th>
                <th className="pb-2 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2">
                    <div className="font-medium text-text">{h.symbol}</div>
                    <div className="text-xs text-text-muted">{ASSET_CLASS_LABEL[h.assetClass] ?? h.assetClass}</div>
                  </td>
                  <td className="py-2 text-right text-text">{formatNumber(h.quantity, 4)}</td>
                  <td className="py-2 text-right text-text">{formatNumber(h.avgPrice)}</td>
                  <td className="py-2 text-right text-text">
                    {h.currentPrice !== null ? formatNumber(h.currentPrice) : "—"}
                  </td>
                  <td className={`py-2 text-right ${h.pnlPct !== null ? changeColorClass(h.pnlPct) : "text-text-muted"}`}>
                    {h.pnlPct !== null ? formatPct(h.pnlPct) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleRemoveHolding(h.id)} className="text-xs text-down hover:underline">
                      remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-muted">Nenhuma posição cadastrada ainda.</p>
        )}

        <form onSubmit={handleAddHolding} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Ativo</label>
            <input
              required
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              placeholder="PETR4"
              className="w-28 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
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
              <option value="fii">FII</option>
              <option value="stocks">Stock (EUA)</option>
              <option value="cripto">Cripto</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Quantidade</label>
            <input
              required
              type="number"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-24 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Preço médio</label>
            <input
              required
              type="number"
              step="any"
              value={form.avgPrice}
              onChange={(e) => setForm({ ...form, avgPrice: e.target.value })}
              className="w-24 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
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

      <Panel title="Alertas de Preço (via Telegram)">
        {alerts && alerts.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/50">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-sm">
                <span className="text-text">
                  {a.symbol} {a.direction === "above" ? "≥" : "≤"} {formatNumber(a.targetPrice)}
                </span>
                <button onClick={() => handleRemoveAlert(a.id)} className="text-xs text-down hover:underline">
                  remover
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Nenhum alerta de preço ativo.</p>
        )}

        <form onSubmit={handleAddAlert} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Ativo</label>
            <input
              required
              value={alertForm.symbol}
              onChange={(e) => setAlertForm({ ...alertForm, symbol: e.target.value })}
              placeholder="PETR4"
              className="w-28 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Classe</label>
            <select
              value={alertForm.assetClass}
              onChange={(e) => setAlertForm({ ...alertForm, assetClass: e.target.value })}
              className="rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            >
              <option value="b3">Ação B3</option>
              <option value="fii">FII</option>
              <option value="stocks">Stock (EUA)</option>
              <option value="cripto">Cripto</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Condição</label>
            <select
              value={alertForm.direction}
              onChange={(e) => setAlertForm({ ...alertForm, direction: e.target.value })}
              className="rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            >
              <option value="above">Preço ≥</option>
              <option value="below">Preço ≤</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Valor alvo</label>
            <input
              required
              type="number"
              step="any"
              value={alertForm.targetPrice}
              onChange={(e) => setAlertForm({ ...alertForm, targetPrice: e.target.value })}
              className="w-24 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
          >
            Criar Alerta
          </button>
        </form>
        <p className="mt-3 text-xs text-text-muted">
          Checagem roda 1x/dia (limite do plano gratuito da Vercel). O alerta dispara uma vez e desativa sozinho.
        </p>
      </Panel>
    </div>
  );
}
