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
  notes: string | null;
  currentPrice: number | null;
  currentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  currency: string | null;
}

interface DrawdownEntry {
  symbol: string;
  drawdown: { maxDrawdownPct: number; peakDate: string; troughDate: string; points: number } | null;
}

interface SharpeResult {
  sharpeRatio: number;
  annualizedReturnPct: number;
  annualizedVolPct: number;
  points: number;
}

interface DividendReceived {
  symbol: string;
  totalReceived: number;
  paymentsCount: number;
}

interface ClosedPosition {
  id: number;
  symbol: string;
  assetClass: string;
  label: string;
  quantity: number;
  avgPrice: number;
  sellPrice: number;
  notes: string | null;
  openedAt: string;
  closedAt: string;
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
  const [drawdowns, setDrawdowns] = useState<DrawdownEntry[] | null>(null);
  const [sharpe, setSharpe] = useState<SharpeResult | null>(null);
  const [dividends, setDividends] = useState<DividendReceived[] | null>(null);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "", assetClass: "b3", quantity: "", avgPrice: "", notes: "" });
  const [alertForm, setAlertForm] = useState({ symbol: "", assetClass: "b3", direction: "above", targetPrice: "" });
  const [submitting, setSubmitting] = useState(false);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [targets, setTargets] = useState({ b3: "40", fii: "20", stocks: "30", cripto: "10" });

  useEffect(() => {
    const saved = localStorage.getItem("portfolio-targets");
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lê preferência salva localmente, sem outra fonte
        setTargets(JSON.parse(saved));
      } catch {
        // ignora preferência corrompida
      }
    }
  }, []);

  function handleSaveTargets(next: typeof targets) {
    setTargets(next);
    localStorage.setItem("portfolio-targets", JSON.stringify(next));
  }

  const load = useCallback(async () => {
    try {
      const [hRes, aRes, mRes, cRes] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/portfolio/alerts"),
        fetch("/api/portfolio/metrics"),
        fetch("/api/portfolio/close"),
      ]);
      const hJson = await hRes.json();
      const aJson = await aRes.json();
      const mJson = await mRes.json();
      const cJson = await cRes.json();
      if (hJson.available) setHoldings(hJson.data);
      else setError(hJson.error ?? "Falha ao carregar carteira");
      if (aJson.available) setAlerts(aJson.data);
      if (mJson.available) {
        setDrawdowns(mJson.drawdowns);
        setSharpe(mJson.sharpe);
        setDividends(mJson.dividends ?? []);
      }
      if (cJson.available) setClosedPositions(cJson.data);
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
        notes: form.notes || undefined,
      }),
    });
    setForm({ symbol: "", assetClass: "b3", quantity: "", avgPrice: "", notes: "" });
    setSubmitting(false);
    load();
  }

  async function handleRemoveHolding(id: number) {
    await fetch(`/api/portfolio?id=${id}`, { method: "DELETE" });
    load();
  }

  async function handleClosePosition(h: Holding) {
    const input = window.prompt(`Preço de venda de ${h.symbol} (por unidade):`, h.currentPrice ? String(h.currentPrice) : "");
    if (!input) return;
    const sellPrice = parseFloat(input.replace(",", "."));
    if (!sellPrice || sellPrice <= 0) return;
    await fetch("/api/portfolio/close", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: h.id, sellPrice }),
    });
    load();
  }

  function handleExportCsv() {
    if (!holdings || holdings.length === 0) return;
    const header = "Ativo,Classe,Quantidade,Preço Médio,Preço Atual,Valor Atual,P&L %,Tese\n";
    const rows = holdings
      .map((h) =>
        [
          h.symbol,
          ASSET_CLASS_LABEL[h.assetClass] ?? h.assetClass,
          h.quantity,
          h.avgPrice,
          h.currentPrice ?? "",
          h.currentValue ?? "",
          h.pnlPct !== null ? h.pnlPct.toFixed(2) : "",
          `"${(h.notes ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carteira-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveNotes(id: number) {
    const notes = notesDraft[id] ?? "";
    await fetch("/api/portfolio", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, notes }),
    });
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

      <Panel title="Rebalanceamento — Alocação Alvo">
        <div className="mb-3 flex flex-wrap gap-3">
          {(Object.keys(targets) as (keyof typeof targets)[]).map((cls) => (
            <div key={cls} className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">{ASSET_CLASS_LABEL[cls] ?? cls} (%)</label>
              <input
                type="number"
                value={targets[cls]}
                onChange={(e) => handleSaveTargets({ ...targets, [cls]: e.target.value })}
                className="w-20 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
              />
            </div>
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-border/50">
          {(Object.keys(targets) as (keyof typeof targets)[]).map((cls) => {
            const totalValue = byClass.reduce((s, c) => s + c.value, 0);
            const currentValue = byClassMap.get(cls) ?? 0;
            const currentPct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
            const targetPct = parseFloat(targets[cls]) || 0;
            const delta = currentPct - targetPct;
            return (
              <li key={cls} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-text">{ASSET_CLASS_LABEL[cls] ?? cls}</span>
                <span className="text-text-muted">
                  {currentPct.toFixed(1)}% atual vs {targetPct.toFixed(0)}% alvo —{" "}
                  <span className={Math.abs(delta) >= 10 ? "text-amber" : "text-text-muted"}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}pp
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-text-muted">
          Defina sua alocação-alvo por classe (fica salva só no seu navegador) — desvios grandes
          (≥10pp) ficam destacados em âmbar.
        </p>
      </Panel>

      <Panel title="Posições" action={<button onClick={handleExportCsv} className="text-xs text-gold-bright hover:underline">exportar CSV</button>}>
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
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleClosePosition(h)} className="mr-2 text-xs text-gold-bright hover:underline">
                      fechar
                    </button>
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
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Tese (opcional)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Por que comprei..."
              className="w-48 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
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

      <Panel title="Risco da Carteira">
        {sharpe ? (
          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-text-muted">Sharpe Ratio (anualizado)</div>
              <div className="text-text">{sharpe.sharpeRatio.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Retorno anualizado</div>
              <div className={changeColorClass(sharpe.annualizedReturnPct)}>{formatPct(sharpe.annualizedReturnPct)}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Volatilidade anualizada</div>
              <div className="text-text">{formatPct(sharpe.annualizedVolPct).replace("+", "")}</div>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-text-muted">
            Sharpe indisponível ainda — precisa de alguns dias de histórico coletado pra calcular.
          </p>
        )}

        {drawdowns && drawdowns.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/50">
            {drawdowns.map((d) => (
              <li key={d.symbol} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-text">{d.symbol}</span>
                <span className="text-down">Máx. drawdown: {formatPct(d.drawdown!.maxDrawdownPct)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Drawdown indisponível ainda pras posições atuais.</p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Sharpe simplificado (sem taxa livre de risco, sem conversão cambial entre BRL/USD) e
          drawdown máximo desde o topo do período coletado (não desde a data de compra). Precisa de
          alguns dias de coleta acumulada pra ficar confiável.
        </p>
      </Panel>

      <Panel title="Tese de Investimento (por posição)">
        {holdings && holdings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {holdings.map((h) => (
              <div key={h.id} className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">{h.symbol}</label>
                <div className="flex gap-2">
                  <textarea
                    value={notesDraft[h.id] ?? h.notes ?? ""}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [h.id]: e.target.value }))}
                    placeholder="Por que comprei, o que espero..."
                    rows={2}
                    className="flex-1 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
                  />
                  <button
                    onClick={() => handleSaveNotes(h.id)}
                    className="self-start rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-xs text-gold-bright hover:bg-panel"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Cadastre uma posição pra anotar sua tese.</p>
        )}
      </Panel>

      <Panel title="Dividendos Recebidos (B3 / FII)">
        {dividends && dividends.length > 0 ? (
          <>
            <ul className="flex flex-col divide-y divide-border/50">
              {dividends.map((d) => (
                <li key={d.symbol} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-text">
                    {d.symbol} <span className="text-text-muted">({d.paymentsCount}x)</span>
                  </span>
                  <span className="text-up">R$ {formatNumber(d.totalReceived)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-muted">
              Via Fundamentus, contado desde a data em que você cadastrou a posição aqui (não a data
              real de compra, que não coletamos) — pode divergir um pouco do que você recebeu de fato
              se cadastrou a posição depois de já ter comprado.
            </p>
          </>
        ) : (
          <p className="text-sm text-text-muted">Nenhum provento encontrado ainda pras posições B3/FII cadastradas.</p>
        )}
      </Panel>

      <Panel title="Posições Fechadas — Tese vs. Resultado Real">
        {closedPositions && closedPositions.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/50">
            {closedPositions.map((p) => {
              const returnPct = ((p.sellPrice - p.avgPrice) / p.avgPrice) * 100;
              return (
                <li key={p.id} className="flex flex-col gap-1 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text">
                      {p.symbol} <span className="text-text-muted">({ASSET_CLASS_LABEL[p.assetClass] ?? p.assetClass})</span>
                    </span>
                    <span className={changeColorClass(returnPct)}>{formatPct(returnPct)}</span>
                  </div>
                  {p.notes && <p className="text-xs text-text-muted">Tese: {p.notes}</p>}
                  <p className="text-xs text-text-muted">
                    {formatNumber(p.avgPrice)} → {formatNumber(p.sellPrice)} · fechado em{" "}
                    {new Date(p.closedAt).toLocaleDateString("pt-BR")}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Nenhuma posição fechada ainda.</p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Use o botão &quot;fechar&quot; numa posição ativa pra registrar aqui — compara sua tese
          original com o resultado real.
        </p>
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
