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
const BROKER_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

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
function calcProfit(entries: ForexEntry[], broker: string, windowDays: number) {
  const brokerEntries = entries
    .filter((e) => e.broker === broker)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  if (brokerEntries.length < 2) return null;

  const latest = brokerEntries[0];
  const cutoff = new Date(latest.recordedAt);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const prior = brokerEntries.slice(1).find((e) => e.recordedAt <= cutoffStr)
    ?? brokerEntries[brokerEntries.length - 1];

  const entriesAfterPrior = brokerEntries.filter((e) => e.recordedAt > prior.recordedAt);
  const totalDeposits = entriesAfterPrior.reduce((s, e) => s + (e.depositUsd ?? 0), 0);
  const totalWithdrawals = entriesAfterPrior.reduce((s, e) => s + (e.withdrawalUsd ?? 0), 0);

  const profit = latest.balanceUsd - prior.balanceUsd - totalDeposits + totalWithdrawals;
  const profitPct = prior.balanceUsd > 0 ? (profit / prior.balanceUsd) * 100 : 0;
  const days = daysBetween(prior.recordedAt, latest.recordedAt);

  return { profit, profitPct, days, totalDeposits, totalWithdrawals };
}

// -------------------------------------------------------------------
// 1. Gráfico de evolução de saldo (SVG puro) — com toggle Saldo $ / Performance %
// -------------------------------------------------------------------
function BalanceChart({ entries, brokers }: { entries: ForexEntry[]; brokers: string[] }) {
  const [mode, setMode] = useState<"usd" | "pct">("usd");

  const allDates = [...new Set(entries.map((e) => e.recordedAt))].sort();
  if (allDates.length < 2) return <p className="text-xs text-text-muted">Registre pelo menos 2 lançamentos pra ver o gráfico.</p>;

  const W = 800;
  const H = 180;
  const PAD = { top: 10, right: 10, bottom: 28, left: 64 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const brokerLines = brokers.map((b, i) => {
    const sorted = entries
      .filter((e) => e.broker === b)
      .sort((a, z) => a.recordedAt.localeCompare(z.recordedAt));
    const base = sorted[0]?.balanceUsd ?? 1;
    return {
      broker: b,
      color: BROKER_COLORS[i % BROKER_COLORS.length],
      points: sorted.map((e) => ({
        date: e.recordedAt,
        val: mode === "pct" ? ((e.balanceUsd - base) / base) * 100 : e.balanceUsd,
      })),
    };
  });

  const totalLine = allDates.map((date) => {
    const total = brokers.reduce((sum, b) => {
      const latest = entries
        .filter((e) => e.broker === b && e.recordedAt <= date)
        .sort((a, z) => z.recordedAt.localeCompare(a.recordedAt))[0];
      return sum + (latest?.balanceUsd ?? 0);
    }, 0);
    return { date, val: total };
  });
  const totalBase = totalLine[0]?.val ?? 1;
  const totalLineFinal = totalLine.map((t) => ({
    date: t.date,
    val: mode === "pct" ? ((t.val - totalBase) / totalBase) * 100 : t.val,
  }));

  const allVals = [
    ...brokerLines.flatMap((l) => l.points.map((p) => p.val)),
    ...(mode === "usd" ? totalLineFinal.map((t) => t.val) : []),
  ];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const span = maxVal - minVal || 1;
  const padded = { min: minVal - span * 0.05, max: maxVal + span * 0.05 };

  const xOf = (date: string) => PAD.left + (allDates.indexOf(date) / (allDates.length - 1)) * innerW;
  const yOf = (val: number) => PAD.top + innerH - ((val - padded.min) / (padded.max - padded.min)) * innerH;

  function toPolyline(pts: { date: string; val: number }[]) {
    return pts.map((p) => `${xOf(p.date)},${yOf(p.val)}`).join(" ");
  }

  const yTicks = [padded.min, (padded.min + padded.max) / 2, padded.max];

  return (
    <div>
      <div className="mb-2 flex gap-1">
        <button
          onClick={() => setMode("usd")}
          className={`rounded px-3 py-1 text-xs ${mode === "usd" ? "border border-gold/50 text-gold-bright" : "border border-border text-text-muted hover:text-text"}`}
        >
          Saldo $
        </button>
        <button
          onClick={() => setMode("pct")}
          className={`rounded px-3 py-1 text-xs ${mode === "pct" ? "border border-gold/50 text-gold-bright" : "border border-border text-text-muted hover:text-text"}`}
        >
          Performance %
        </button>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[360px]" style={{ fontFamily: "var(--font-geist-sans, sans-serif)" }}>
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} stroke="var(--color-border, #333)" strokeWidth={0.5} strokeDasharray="3,3" />
              <text x={PAD.left - 4} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--color-text-muted, #888)">
                {mode === "pct" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : `$${Math.round(v).toLocaleString("pt-BR")}`}
              </text>
            </g>
          ))}
          {mode === "pct" && (
            <line x1={PAD.left} y1={yOf(0)} x2={W - PAD.right} y2={yOf(0)} stroke="#ffffff" strokeWidth={0.5} opacity={0.2} />
          )}
          {[0, Math.floor((allDates.length - 1) / 2), allDates.length - 1].filter((v, i, arr) => arr.indexOf(v) === i).map((idx) => (
            <text key={idx} x={PAD.left + (idx / (allDates.length - 1)) * innerW} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--color-text-muted, #888)">
              {new Date(allDates[idx]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </text>
          ))}
          {brokerLines.map(({ broker, color, points }) =>
            points.length >= 2 ? (
              <polyline key={broker} points={toPolyline(points)} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
            ) : null
          )}
          {mode === "usd" && totalLineFinal.length >= 2 && (
            <polyline points={toPolyline(totalLineFinal)} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="6,3" opacity={0.6} />
          )}
          {brokerLines.map(({ broker, color, points }) =>
            points.map((p, i) => (
              <circle key={`${broker}-${i}`} cx={xOf(p.date)} cy={yOf(p.val)} r={3} fill={color} />
            ))
          )}
        </svg>
        <div className="mt-1 flex flex-wrap gap-3">
          {brokerLines.map(({ broker, color }) => (
            <div key={broker} className="flex items-center gap-1">
              <div className="h-2 w-4 rounded-sm" style={{ background: color }} />
              <span className="text-xs text-text-muted">{broker}</span>
            </div>
          ))}
          {mode === "usd" && (
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4 border-t-2 border-dashed border-white/60" />
              <span className="text-xs text-text-muted">Total</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// 3. Rentabilidade mensal consolidada
// -------------------------------------------------------------------
function MonthlyPnL({ entries, brokers }: { entries: ForexEntry[]; brokers: string[] }) {
  // Agrupar por mês: "2026-09", "2026-10" etc.
  const months = [...new Set(entries.map((e) => e.recordedAt.slice(0, 7)))].sort().reverse();
  if (months.length === 0) return <p className="text-sm text-text-muted">Sem dados mensais ainda.</p>;

  function getMonthReturn(broker: string, month: string) {
    const bEntries = entries
      .filter((e) => e.broker === broker)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

    const monthEntries = bEntries.filter((e) => e.recordedAt.startsWith(month));
    if (monthEntries.length === 0) return null;

    const lastOfMonth = monthEntries[monthEntries.length - 1];
    // Último saldo do mês anterior
    const prevEntry = bEntries.filter((e) => e.recordedAt < month + "-01").slice(-1)[0];
    if (!prevEntry) return null;

    const deposits = monthEntries.reduce((s, e) => s + (e.depositUsd ?? 0), 0);
    const withdrawals = monthEntries.reduce((s, e) => s + (e.withdrawalUsd ?? 0), 0);
    const profit = lastOfMonth.balanceUsd - prevEntry.balanceUsd - deposits + withdrawals;
    const pct = prevEntry.balanceUsd > 0 ? (profit / prevEntry.balanceUsd) * 100 : 0;
    return { profit, pct };
  }

  function getTotalReturn(month: string) {
    const results = brokers.map((b) => getMonthReturn(b, month)).filter(Boolean) as { profit: number; pct: number }[];
    if (results.length === 0) return null;
    const totalProfit = results.reduce((s, r) => s + r.profit, 0);
    // Base = soma dos saldos no início do mês de todos os brokers com dados
    let base = 0;
    for (const b of brokers) {
      const bEntries = entries.filter((e) => e.broker === b && e.recordedAt < month + "-01");
      if (bEntries.length > 0) base += bEntries.sort((a, z) => z.recordedAt.localeCompare(a.recordedAt))[0].balanceUsd;
    }
    return { profit: totalProfit, pct: base > 0 ? (totalProfit / base) * 100 : 0 };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="pb-2 font-medium">Mês</th>
            {brokers.map((b) => <th key={b} className="pb-2 font-medium text-right">{b}</th>)}
            <th className="pb-2 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => {
            const total = getTotalReturn(month);
            return (
              <tr key={month} className="border-b border-border/40 last:border-0">
                <td className="py-1.5 text-text-muted">
                  {new Date(month + "-15").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </td>
                {brokers.map((b) => {
                  const r = getMonthReturn(b, month);
                  return (
                    <td key={b} className="py-1.5 text-right">
                      {r ? (
                        <span className={r.pct >= 0 ? "text-up" : "text-down"} title={fmt(r.profit)}>
                          {fmtPct(r.pct)}
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                  );
                })}
                <td className="py-1.5 text-right font-medium">
                  {total ? (
                    <span className={total.pct >= 0 ? "text-up" : "text-down"} title={fmt(total.profit)}>
                      {fmtPct(total.pct)}
                    </span>
                  ) : <span className="text-text-muted">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-text-muted">
        Lucro mensal = saldo final do mês − saldo final do mês anterior − depósitos + retiradas. Passe o mouse sobre o % pra ver o valor em USD.
      </p>
    </div>
  );
}

// -------------------------------------------------------------------
// 4. Export CSV
// -------------------------------------------------------------------
function exportCsv(entries: ForexEntry[]) {
  if (entries.length === 0) return;
  const header = "Data,Corretora,Saldo (USD),Depósito (USD),Retirada (USD)\n";
  const rows = entries
    .map((e) => [e.recordedAt, e.broker, e.balanceUsd, e.depositUsd, e.withdrawalUsd].join(","))
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forex-carteira-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Lucro do mês corrente (1º dia até hoje), somado entre todas as corretoras — mesma convenção de
// calcProfit (janela de N dias a partir da entrada mais recente), só que N = dia do mês atual.
interface MonthProgress {
  profit: number;
  baseBalance: number;
  daysElapsed: number;
  daysInMonth: number;
}

function computeMonthProgress(entries: ForexEntry[], brokers: string[]): MonthProgress | null {
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  let totalProfit = 0;
  let totalBalance = 0;
  let hasAny = false;

  for (const broker of brokers) {
    const p = calcProfit(entries, broker, daysElapsed);
    const latest = entries
      .filter((e) => e.broker === broker)
      .sort((a, z) => z.recordedAt.localeCompare(a.recordedAt))[0];
    if (latest) totalBalance += latest.balanceUsd;
    if (p) {
      totalProfit += p.profit;
      hasAny = true;
    }
  }

  if (!hasAny) return null;
  return { profit: totalProfit, baseBalance: totalBalance - totalProfit, daysElapsed, daysInMonth };
}

// -------------------------------------------------------------------
// Simulador de meta
// -------------------------------------------------------------------
function GoalSimulator({ initialBalance, monthProgress }: { initialBalance: number; monthProgress: MonthProgress | null }) {
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
  while (bal < goalVal && rows.length < 600) {
    const startBal = bal;
    const ret = bal * (rateVal / 100);
    bal = bal + ret + monthlyVal;
    rows.push({ month: rows.length + 1, startBal, contribution: monthlyVal, return: ret, endBal: bal });
  }

  return (
    <Panel title="Simulador de meta">
      <p className="mb-3 text-xs text-text-muted">
        Juros compostos: saldo inicial + aporte mensal, rendendo a taxa mensal informada, até bater a meta. Só simulação — não salva nada.
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
      {rows.length > 0 && goalVal > 0 && bal >= goalVal && (
        <p className="mb-3 text-sm font-medium text-up">
          Meta de {fmt(goalVal)} atingida em {rows.length} meses (~{(rows.length / 12).toFixed(1)} anos).
        </p>
      )}

      {monthProgress && (
        <div className="mb-4 rounded border border-border bg-panel-alt p-3">
          <p className="text-xs font-medium text-text-muted">Progresso real deste mês vs. simulado</p>
          {(() => {
            const expectedFullMonth = monthProgress.baseBalance * (rateVal / 100);
            const expectedToDate = (expectedFullMonth * monthProgress.daysElapsed) / monthProgress.daysInMonth;
            const diff = monthProgress.profit - expectedToDate;
            const ahead = diff >= 0;
            return (
              <p className="mt-1 text-sm text-text">
                Lucro real no mês:{" "}
                <span className={ahead ? "text-up" : "text-down"}>{fmt(monthProgress.profit)}</span>
                {" · "}esperado até hoje (dia {monthProgress.daysElapsed}/{monthProgress.daysInMonth} a {rateVal}%/mês):{" "}
                {fmt(expectedToDate)} · {ahead ? "à frente" : "atrás"} da meta em {fmt(Math.abs(diff))}
              </p>
            );
          })()}
        </div>
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

// -------------------------------------------------------------------
// Linha editável do histórico
// -------------------------------------------------------------------
function HistoryRow({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: ForexEntry;
  onUpdate: (id: number, fields: { balance_usd: string; deposit_usd: string; withdrawal_usd: string; recorded_at: string }) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recordedAt, setRecordedAt] = useState(entry.recordedAt.slice(0, 10));
  const [balance, setBalance] = useState(String(entry.balanceUsd));
  const [deposit, setDeposit] = useState(String(entry.depositUsd));
  const [withdrawal, setWithdrawal] = useState(String(entry.withdrawalUsd));

  async function save() {
    setBusy(true);
    await onUpdate(entry.id, { balance_usd: balance, deposit_usd: deposit, withdrawal_usd: withdrawal, recorded_at: recordedAt });
    setBusy(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-b border-border/40 last:border-0">
        <td className="py-1.5">
          <input type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} className="w-32 rounded border border-border bg-panel-alt px-1.5 py-1 text-xs text-text" />
        </td>
        <td className="py-1.5 text-text">{entry.broker}</td>
        <td className="py-1.5 text-right">
          <input type="number" step="any" value={balance} onChange={(e) => setBalance(e.target.value)} className="w-24 rounded border border-border bg-panel-alt px-1.5 py-1 text-right text-xs text-text" />
        </td>
        <td className="py-1.5 text-right">
          <input type="number" step="any" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="w-20 rounded border border-border bg-panel-alt px-1.5 py-1 text-right text-xs text-text" />
        </td>
        <td className="py-1.5 text-right">
          <input type="number" step="any" value={withdrawal} onChange={(e) => setWithdrawal(e.target.value)} className="w-20 rounded border border-border bg-panel-alt px-1.5 py-1 text-right text-xs text-text" />
        </td>
        <td className="py-1.5 text-right whitespace-nowrap">
          <button onClick={save} disabled={busy} className="text-xs text-gold-bright hover:underline disabled:opacity-50">salvar</button>
          <button onClick={() => setEditing(false)} disabled={busy} className="ml-2 text-xs text-text-muted hover:underline">cancelar</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="py-1.5 text-xs text-text-muted">{new Date(entry.recordedAt).toLocaleDateString("pt-BR")}</td>
      <td className="py-1.5 text-text">{entry.broker}</td>
      <td className="py-1.5 text-right text-text">{fmt(entry.balanceUsd)}</td>
      <td className="py-1.5 text-right">
        {entry.depositUsd > 0 ? <span className="text-up">{fmt(entry.depositUsd)}</span> : <span className="text-up opacity-40">—</span>}
      </td>
      <td className="py-1.5 text-right">
        {entry.withdrawalUsd > 0 ? <span className="text-down">{fmt(entry.withdrawalUsd)}</span> : <span className="text-down opacity-40">—</span>}
      </td>
      <td className="py-1.5 text-right whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-bright hover:underline">editar</button>
        <button onClick={() => onDelete(entry.id)} className="ml-2 text-xs text-down hover:underline">remover</button>
      </td>
    </tr>
  );
}

// -------------------------------------------------------------------
// Componente principal
// -------------------------------------------------------------------
export function ForexCarteiraManager() {
  const [entries, setEntries] = useState<ForexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(7);
  const [pendingDays, setPendingDays] = useState(7);
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

  async function handleUpdate(id: number, fields: { balance_usd: string; deposit_usd: string; withdrawal_usd: string; recorded_at: string }) {
    await fetch("/api/forex/carteira", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        balance_usd: parseFloat(fields.balance_usd),
        deposit_usd: parseFloat(fields.deposit_usd) || 0,
        withdrawal_usd: parseFloat(fields.withdrawal_usd) || 0,
        recorded_at: fields.recorded_at,
      }),
    });
    load();
  }

  if (error) {
    return (
      <Panel title="Carteira Forex">
        <p className="text-sm text-text-muted">Configure DATABASE_URL para habilitar. ({error})</p>
      </Panel>
    );
  }

  const brokers = entries ? [...new Set(entries.map((e) => e.broker))] : [];

  const latestByBroker = Object.fromEntries(
    brokers.map((b) => {
      const latest = entries!
        .filter((e) => e.broker === b)
        .sort((a, z) => z.recordedAt.localeCompare(a.recordedAt))[0];
      return [b, latest];
    })
  );

  const totalBalance = brokers.reduce((s, b) => s + (latestByBroker[b]?.balanceUsd ?? 0), 0);
  const monthProgress = entries ? computeMonthProgress(entries, brokers) : null;

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
              <label className="text-xs text-text-muted">Nome</label>
              <input
                required
                value={form.customBroker}
                onChange={(e) => setForm((f) => ({ ...f, customBroker: e.target.value }))}
                placeholder="Nome da corretora"
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
            value={pendingDays}
            onChange={(e) => setPendingDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 7)))}
            className="w-16 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
          />
          <button
            onClick={() => setWindowDays(pendingDays)}
            className="rounded border border-border bg-panel-alt px-3 py-1 text-xs text-gold-bright hover:bg-panel"
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
                <th className="pb-2 font-medium text-right">ROI total</th>
                <th className="pb-2 font-medium text-right">Atualizado</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {brokers.map((b) => {
                const latest = latestByBroker[b];
                const p = entries ? calcProfit(entries, b, windowDays) : null;
                // ROI total: (saldo atual - primeiro saldo - aportes líquidos) / primeiro saldo
                const bAll = entries!.filter((e) => e.broker === b).sort((a, z) => a.recordedAt.localeCompare(z.recordedAt));
                const firstBalance = bAll[0]?.balanceUsd ?? 0;
                const totalDeposited = bAll.reduce((s, e) => s + (e.depositUsd ?? 0), 0);
                const totalWithdrawn = bAll.reduce((s, e) => s + (e.withdrawalUsd ?? 0), 0);
                const netInvested = firstBalance + totalDeposited - totalWithdrawn;
                const roiPct = netInvested > 0 ? (((latest?.balanceUsd ?? 0) - netInvested) / netInvested) * 100 : null;
                return (
                  <tr key={b} className="border-b border-border/50 last:border-0">
                    <td className="py-2 font-medium text-text">{b}</td>
                    <td className="py-2 text-right text-text">{fmt(latest?.balanceUsd ?? 0)}</td>
                    <td className="py-2 text-right">
                      {p ? (
                        <span className={p.profit >= 0 ? "text-up" : "text-down"}>
                          {fmtPct(p.profitPct)}
                          <span className="ml-1 text-xs text-text-muted">({p.days}d)</span>
                          {p.totalDeposits > 0 && <span className="ml-1 text-xs text-text-muted">dep {fmt(p.totalDeposits)}</span>}
                          {p.totalWithdrawals > 0 && <span className="ml-1 text-xs text-text-muted">ret {fmt(p.totalWithdrawals)}</span>}
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="py-2 text-right">
                      {roiPct !== null ? (
                        <span className={roiPct >= 0 ? "text-up" : "text-down"} title={`Investido líquido: ${fmt(netInvested)}`}>
                          {fmtPct(roiPct)}
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="py-2 text-right text-xs text-text-muted">
                      {latest ? new Date(latest.recordedAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => handleDelete(latest.id)} className="text-xs text-down hover:underline">remover</button>
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
                    return <span className={totalProfit >= 0 ? "font-semibold text-up" : "font-semibold text-down"}>{fmtPct(pct)}</span>;
                  })()}
                </td>
                <td className="pt-2 text-right">
                  {(() => {
                    const allFirst = brokers.reduce((s, b) => {
                      const bAll = entries!.filter((e) => e.broker === b).sort((a, z) => a.recordedAt.localeCompare(z.recordedAt));
                      const first = bAll[0]?.balanceUsd ?? 0;
                      const dep = bAll.reduce((s, e) => s + (e.depositUsd ?? 0), 0);
                      const wit = bAll.reduce((s, e) => s + (e.withdrawalUsd ?? 0), 0);
                      return s + first + dep - wit;
                    }, 0);
                    if (allFirst <= 0) return <span className="text-text-muted">—</span>;
                    const roi = ((totalBalance - allFirst) / allFirst) * 100;
                    return <span className={roi >= 0 ? "font-semibold text-up" : "font-semibold text-down"} title={`Investido líquido total: ${fmt(allFirst)}`}>{fmtPct(roi)}</span>;
                  })()}
                </td>
                <td /><td />
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-muted">Nenhum lançamento cadastrado ainda. Use o formulário acima.</p>
        )}
        {entries !== null && brokers.length > 0 && (
          <p className="mt-2 text-xs text-text-muted">
            Só calcula quando houver um lançamento anterior à janela escolhida. Registre um novo saldo hoje e o lucro aparece automaticamente.
          </p>
        )}
      </Panel>

      {/* 1. Gráfico de evolução */}
      {entries && entries.length >= 2 && (
        <Panel title="Evolução do saldo">
          <BalanceChart entries={entries} brokers={brokers} />
        </Panel>
      )}

      {/* 3. Rentabilidade mensal */}
      {entries && entries.length > 0 && (
        <Panel title="Rentabilidade mensal">
          <MonthlyPnL entries={entries} brokers={brokers} />
        </Panel>
      )}

      {/* Simulador de meta */}
      <GoalSimulator initialBalance={totalBalance} monthProgress={monthProgress} />

      {/* Histórico completo + 4. export CSV */}
      <Panel
        title="Histórico de lançamentos"
        action={
          entries && entries.length > 0 ? (
            <button onClick={() => exportCsv(entries)} className="text-xs text-gold-bright hover:underline">
              exportar CSV
            </button>
          ) : undefined
        }
      >
        <p className="mb-2 text-xs text-text-muted">
          Cada linha é um lançamento seu — pra ver exatamente quando fez cada depósito, retirada ou atualização de saldo.
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
                <HistoryRow key={e.id} entry={e} onUpdate={handleUpdate} onDelete={handleDelete} />
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
