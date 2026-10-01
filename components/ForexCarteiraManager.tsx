"use client";

import { useEffect, useState, useCallback } from "react";
import { Panel } from "@/components/Panel";

interface ForexEntry {
  id: number;
  broker: string;
  balanceUsd: number;
  depositUsd: number;
  withdrawalUsd: number;
  recordedAt: string;
}

const DEFAULT_BROKERS = ["EBC", "AXI", "ICMarkets", "FBS", "XM", "Pepperstone", "Outro"];

function fmt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
function fmtPct(value: number): string {
  return (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// Para cada broker, calcula lucro de N dias a partir da entrada mais recente.
// Busca a entrada mais antiga disponível dentro da janela de N dias (ou anterior a ela).
function calcProfit(entries: ForexEntry[], broker: string, windowDays: number) {
  const brokerEntries = entries
    .filter((e) => e.broker === broker)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  if (brokerEntries.length < 2) return null;

  const latest = brokerEntries[0];
  const latestDate = new Date(latest.recordedAt);
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - windowDays);

  // Entradas dentro da janela (excluindo a mais recente) + a imediatamente anterior
  const windowEntries = brokerEntries.slice(1).filter((e) => new Date(e.recordedAt) >= cutoff);
  // Procura a referência: última entrada antes ou no início da janela
  const prior = brokerEntries.slice(1).find((e) => new Date(e.recordedAt) <= cutoff)
    ?? brokerEntries[brokerEntries.length - 1];

  // Soma depósitos e retiradas de todas entradas APÓS a referência (inclusive as da janela)
  const entriesAfterPrior = brokerEntries.filter((e) => e.recordedAt > prior.recordedAt);
  const totalDeposits = entriesAfterPrior.reduce((s, e) => s + (e.depositUsd ?? 0), 0);
  const totalWithdrawals = entriesAfterPrior.reduce((s, e) => s + (e.withdrawalUsd ?? 0), 0);

  const profit = latest.balanceUsd - prior.balanceUsd - totalDeposits + totalWithdrawals;
  const profitPct = prior.balanceUsd > 0 ? (profit / prior.balanceUsd) * 100 : 0;
  const days = daysBetween(prior.recordedAt, latest.recordedAt);

  return { profit, profitPct, days, totalDeposits, totalWithdrawals, prior };
}

function GoalSimulator({ initialBalance }: { initialBalance: number }) {
  const [start, setStart] = useState(String(Math.round(initialBalance)));
  const [monthly, setMonthly] = useState("0");
  const [rate, setRate] = useState("2");
  const [goal, setGoal] = useState("80000");

  const startVal = parseFloat(start) || 0;
  const monthlyVal = parseFloat(monthly) || 0;
  const rateVal = parseFloat(rate) || 0;
  const goalVal = parseFloat(goal) || 0;

  const rows: { month: number; startBal: number; contribution: number; return: number; endBal: number }[] = [];
  let bal = startVal;
  const MAX_MONTHS = 600;
  while (bal < goalVal && rows.length < MAX_MONTHS) {
    const startBal = bal;
    const ret = bal * (rateVal / 100);
    bal = bal + ret + monthlyVal;
    rows.push({ month: rows.length + 1, startBal, contribution: monthlyVal, return: ret, endBal: bal });
  }
  const reached = bal >= goalVal;

  return (
    <Panel title="Simulador de meta">
      <p className="mb-3 text-xs text-text-muted">
        Juros compostos: saldo inicial + aporte mensal, rendendo a taxa mensal informada, até bater a meta. Só simulação
        — não salva nada, mexe os valores à vontade.
      </p>
      <div className="mb-4 flex flex-wrap gap-3">
        {[
          { label: "Saldo inicial (USD)", val: start, set: setStart },
          { label: "Aporte por mês (USD)", val: monthly, set: setMonthly },
          { label: "Taxa ao mês (%)", val: rate, set: setRate },
          { label: "Meta (USD)", val: goal, set: setGoal },
        ].map(({ label, val, set }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">{label}</label>
            <input
              type="number"
              step="any"
              value={val}
              onChange={(e) => set(e.target.value)}
              className="w-36 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
        ))}
      </div>
      {reached && goalVal > 0 && (
        <p className="mb-3 text-sm font-medium text-up">
          Meta de {fmt(goalVal)} atingida em {rows.length} meses (~{(rows.length / 12).toFixed(1)} anos).
        </p>
      )}
      {rows.length > 0 && (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="pb-1 font-medium">Mês</th>
                <th className="pb-1 font-medium text-right">Saldo início</th>
                <th className="pb-1 font-medium text-right">Aporte</th>
                <th className="pb-1 font-medium text-right">Rendimento</th>
                <th className="pb-1 font-medium text-right">Saldo fim</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 120).map((r) => (
                <tr key={r.month} className="border-b border-border/40 last:border-0">
                  <td className="py-1 text-text-muted">{r.month}</td>
                  <td className="py-1 text-right text-text">{fmt(r.startBal)}</td>
                  <td className="py-1 text-right text-up">{fmt(r.contribution)}</td>
                  <td className="py-1 text-right text-up">{fmt(r.return)}</td>
                  <td className="py-1 text-right text-text">{fmt(r.endBal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function ForexCarteiraManager() {
  const [entries, setEntries] = useState<ForexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(7);
  const [form, setForm] = useState({
    broker: "EBC",
    customBroker: "",
    recorded_at: new Date().toISOString().slice(0, 10),
    balance_usd: "",
    deposit_usd: "0",
    withdrawal_usd: "0",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/forex/carteira");
      const json = await res.json();
      if (json.available) setEntries(json.data);
      else setError(json.error ?? "Erro ao carregar entradas");
    } catch {
      setError("Falha ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const broker = form.broker === "Outro" ? form.customBroker.trim() : form.broker;
    if (!broker) return;
    await fetch("/api/forex/carteira", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        broker,
        balance_usd: parseFloat(form.balance_usd),
        deposit_usd: parseFloat(form.deposit_usd) || 0,
        withdrawal_usd: parseFloat(form.withdrawal_usd) || 0,
        recorded_at: form.recorded_at,
      }),
    });
    setForm((f) => ({ ...f, balance_usd: "", deposit_usd: "0", withdrawal_usd: "0" }));
    setSubmitting(false);
    load();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/forex/carteira?id=${id}`, { method: "DELETE" });
    load();
  }

  if (error) {
    return (
      <Panel title="Carteira Forex">
        <p className="text-sm text-text-muted">Configure DATABASE_URL para habilitar. ({error})</p>
      </Panel>
    );
  }

  // Brokers únicos e seus saldos mais recentes
  const brokers = entries
    ? [...new Set(entries.map((e) => e.broker))]
    : [];

  const latestByBroker = Object.fromEntries(
    brokers.map((b) => {
      const latest = entries!.filter((e) => e.broker === b).sort((a, z) => z.recordedAt.localeCompare(a.recordedAt))[0];
      return [b, latest];
    })
  );

  const totalBalance = brokers.reduce((s, b) => s + (latestByBroker[b]?.balanceUsd ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Formulário de novo lançamento */}
      <Panel title="Novo lançamento">
        <p className="mb-3 text-xs text-text-muted">
          Registre o saldo atual de cada corretora quando quiser — mesmo sem atualizar diariamente, o sistema calcula
          automaticamente o lucro desde a última entrada registrada.
        </p>
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Corretora</label>
            <select
              value={form.broker}
              onChange={(e) => setForm((f) => ({ ...f, broker: e.target.value }))}
              className="rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            >
              {DEFAULT_BROKERS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {form.broker === "Outro" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Nome da corretora</label>
              <input
                required
                value={form.customBroker}
                onChange={(e) => setForm((f) => ({ ...f, customBroker: e.target.value }))}
                placeholder="Nome"
                className="w-28 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Data</label>
            <input
              type="date"
              required
              value={form.recorded_at}
              onChange={(e) => setForm((f) => ({ ...f, recorded_at: e.target.value }))}
              className="rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Saldo atual (USD)</label>
            <input
              type="number"
              step="any"
              required
              value={form.balance_usd}
              onChange={(e) => setForm((f) => ({ ...f, balance_usd: e.target.value }))}
              placeholder="ex: 1949"
              className="w-28 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Depósito (se fez)</label>
            <input
              type="number"
              step="any"
              value={form.deposit_usd}
              onChange={(e) => setForm((f) => ({ ...f, deposit_usd: e.target.value }))}
              className="w-20 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Retirada (se fez)</label>
            <input
              type="number"
              step="any"
              value={form.withdrawal_usd}
              onChange={(e) => setForm((f) => ({ ...f, withdrawal_usd: e.target.value }))}
              className="w-20 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded border border-gold/40 bg-panel-alt px-4 py-1.5 text-sm text-gold-bright hover:bg-panel"
          >
            Salvar
          </button>
        </form>
      </Panel>

      {/* Resumo por corretora */}
      <Panel title="Carteira">
        <p className="mb-3 text-xs text-text-muted">
          Saldo das suas corretoras de forex (preenchimento manual). Lucro descontando depósitos/retiradas do período,
          pra não confundir aporte com ganho — em USD.
        </p>

        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs text-text-muted">Lucro dos últimos N dias (1 a 30)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={windowDays}
            onChange={(e) => setWindowDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 7)))}
            className="w-20 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
          />
          <button
            onClick={() => setWindowDays(windowDays)}
            className="rounded border border-border bg-panel-alt px-3 py-1 text-xs text-text-muted hover:text-text"
          >
            Aplicar
          </button>
        </div>

        {entries !== null && brokers.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="pb-2 font-medium">Corretora</th>
                <th className="pb-2 font-medium text-right">Saldo</th>
                <th className="pb-2 font-medium text-right">Lucro {windowDays} dias (lucro % · depósito · retirada)</th>
                <th className="pb-2 font-medium text-right">Atualizado</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {brokers.map((b) => {
                const latest = latestByBroker[b];
                const p = entries ? calcProfit(entries, b, windowDays) : null;
                return (
                  <tr key={b} className="border-b border-border/50 last:border-0">
                    <td className="py-2 font-medium text-text">{b}</td>
                    <td className="py-2 text-right text-text">{fmt(latest?.balanceUsd ?? 0)}</td>
                    <td className="py-2 text-right">
                      {p ? (
                        <span className={p.profit >= 0 ? "text-up" : "text-down"}>
                          {fmtPct(p.profitPct)}
                          {p.totalDeposits > 0 && <span className="ml-1 text-xs text-text-muted">−dep {fmt(p.totalDeposits)}</span>}
                          {p.totalWithdrawals > 0 && <span className="ml-1 text-xs text-text-muted">+ret {fmt(p.totalWithdrawals)}</span>}
                          <span className="ml-1 text-xs text-text-muted">({p.days}d)</span>
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-xs text-text-muted">
                      {latest ? new Date(latest.recordedAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleDelete(latest.id)}
                        className="text-xs text-down hover:underline"
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border">
                <td className="pt-2 font-semibold text-text">Total</td>
                <td className="pt-2 text-right font-semibold text-text">{fmt(totalBalance)}</td>
                <td className="pt-2 text-right">
                  {(() => {
                    const profits = brokers.map((b) => calcProfit(entries!, b, windowDays));
                    const hasSome = profits.some(Boolean);
                    if (!hasSome) return <span className="text-text-muted">—</span>;
                    const totalProfit = profits.reduce((s, p) => s + (p?.profit ?? 0), 0);
                    const base = totalBalance - totalProfit;
                    const pct = base > 0 ? (totalProfit / base) * 100 : 0;
                    return (
                      <span className={totalProfit >= 0 ? "font-semibold text-up" : "font-semibold text-down"}>
                        {fmtPct(pct)}
                      </span>
                    );
                  })()}
                </td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-muted">Nenhum lançamento cadastrado ainda. Use o formulário acima para registrar seu primeiro saldo.</p>
        )}

        {entries !== null && brokers.length > 0 && (
          <p className="mt-3 text-xs text-text-muted">
            Só calcula quando houver um lançamento anterior à janela escolhida — com um único saldo cadastrado, ainda
            não dá pra calcular. Registre um novo saldo hoje e o lucro aparece automaticamente.
          </p>
        )}
      </Panel>

      {/* Simulador de meta */}
      <GoalSimulator initialBalance={totalBalance} />

      {/* Histórico completo */}
      <Panel title="Histórico de lançamentos">
        <p className="mb-2 text-xs text-text-muted">
          Cada linha é um lançamento seu — pra você ver exatamente quando fez cada depósito, retirada ou atualização de saldo.
        </p>
        {entries && entries.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="pb-2 font-medium">Data</th>
                <th className="pb-2 font-medium">Corretora</th>
                <th className="pb-2 font-medium text-right">Saldo</th>
                <th className="pb-2 font-medium text-right">Depósito</th>
                <th className="pb-2 font-medium text-right">Retirada</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 text-xs text-text-muted">{new Date(e.recordedAt).toLocaleDateString("pt-BR")}</td>
                  <td className="py-1.5 text-text">{e.broker}</td>
                  <td className="py-1.5 text-right text-text">{fmt(e.balanceUsd)}</td>
                  <td className="py-1.5 text-right">
                    {e.depositUsd > 0 ? <span className="text-up">{fmt(e.depositUsd)}</span> : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    {e.withdrawalUsd > 0 ? <span className="text-down">{fmt(e.withdrawalUsd)}</span> : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-down hover:underline">
                      remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-muted">Nenhum histórico ainda.</p>
        )}
      </Panel>
    </div>
  );
}
