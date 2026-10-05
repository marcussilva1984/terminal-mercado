"use client";

import { useEffect, useState, useCallback } from "react";

// ─── tipos ───────────────────────────────────────────────────────────────────
interface ForexIdea {
  id: string;
  pair: string;        // "EUR/USD"
  symbol: string;      // Yahoo: "EURUSD=X"
  direction: "long" | "short";
  entry: number;
  target: number;
  stop: number;
  conviction: "high" | "medium";
  label: string;
  rationale: string;   // carry / COT / tendência
  hedge?: string;      // texto descrevendo o par que hedgeia
  timeframe: string;
  createdAt: string;
  status: "active" | "target_hit" | "stopped";
}

interface PriceMap { [symbol: string]: { price: number; changePct: number } }

// ─── carry rates (taxas base dos BCs — revisar após cada decisão) ────────────
const CARRY_RATES: Record<string, number> = {
  USD: 5.25, EUR: 3.75, GBP: 5.00, JPY: 0.10,
  AUD: 4.35, NZD: 5.50, CAD: 4.75, CHF: 1.50,
};

// ─── ideias pré-carregadas (educacional — adapte preços antes de operar) ─────
const SEED_IDEAS: ForexIdea[] = [
  // ── ALTA CONVICÇÃO (vermelho) ─────────────────────────────────────────────
  {
    id: "1", pair: "AUD/JPY", symbol: "AUDJPY=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "high",
    label: "Carry + Tendência altista",
    rationale: "RBA hawkish (4.35%) vs BoJ ultra-dovish (0.10%) = carry +4.25%. Tendência semanal de alta. COT: Large Specs líquidos comprados em AUD, vendidos em JPY.",
    timeframe: "W1/D1 entrada 4H",
    createdAt: new Date().toISOString(), status: "active",
  },
  {
    id: "2", pair: "NZD/JPY", symbol: "NZDJPY=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "high",
    label: "Maior carry G10 vs JPY",
    rationale: "RBNZ (5.50%) vs BoJ (0.10%) = +5.40% carry anual. Correlaciona com risk-on. COT Large Specs: net long NZD, net short JPY. Entrada em pull-back diário.",
    timeframe: "W1/D1 entrada 4H",
    createdAt: new Date().toISOString(), status: "active",
  },
  {
    id: "3", pair: "GBP/JPY", symbol: "GBPJPY=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "high",
    label: "Carry + BoE hawkish",
    rationale: "BoE (5.00%) vs BoJ (0.10%). Tendência secular de alta desde 2020. Volátil — stop largo. Ideal pra carregar com tamanho reduzido.",
    timeframe: "W1/D1 entrada 4H",
    createdAt: new Date().toISOString(), status: "active",
  },
  {
    id: "4", pair: "EUR/JPY", symbol: "EURJPY=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "high",
    label: "Carry moderado + demanda EUR",
    rationale: "BCE (3.75%) vs BoJ (0.10%). Menor carry que GBP/JPY mas menos volátil. COT: Commercials cobertos, Specs net long EUR.",
    timeframe: "W1/D1 entrada 4H",
    createdAt: new Date().toISOString(), status: "active",
  },
  {
    id: "5", pair: "NZD/CHF", symbol: "NZDCHF=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "high",
    label: "Carry assimétrico vs CHF",
    rationale: "RBNZ (5.50%) vs SNB (1.50%) = +4.00% carry. CHF tende a enfraquecer quando risk-on. Assimetria: R:R bom se definir stop abaixo do suporte semanal.",
    timeframe: "W1/D1 entrada 4H",
    createdAt: new Date().toISOString(), status: "active",
  },

  // ── MÉDIA CONVICÇÃO (amarelo) ─────────────────────────────────────────────
  {
    id: "6", pair: "GBP/CHF", symbol: "GBPCHF=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "medium",
    label: "Carry + BoE vs SNB",
    rationale: "BoE (5.00%) vs SNB (1.50%) = +3.50%. Tendência de alta mas CHF pode apreciar em crises. Confirmar no COT se Specs estão net short CHF.",
    timeframe: "D1 entrada 4H",
    createdAt: new Date().toISOString(), status: "active",
  },
  {
    id: "7", pair: "AUD/CHF", symbol: "AUDCHF=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "medium",
    label: "Carry AUD + CHF fraco em risk-on",
    rationale: "RBA (4.35%) vs SNB (1.50%) = +2.85%. Funciona bem quando commodities sobem (AUD = moeda de commodities). Monitorar minério de ferro.",
    timeframe: "D1 entrada 4H",
    createdAt: new Date().toISOString(), status: "active",
  },
  {
    id: "8", pair: "EUR/CHF", symbol: "EURCHF=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "medium",
    label: "BCE vs SNB — convergência",
    rationale: "BCE (3.75%) vs SNB (1.50%). SNB intervém pra evitar CHF muito forte. Suporte histórico no EUR/CHF. Menos carry mas mais estável.",
    timeframe: "W1/D1",
    createdAt: new Date().toISOString(), status: "active",
  },

  // ── HEDGE / DEFESA ────────────────────────────────────────────────────────
  {
    id: "9", pair: "USD/CHF", symbol: "USDCHF=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "medium",
    label: "Hedge — long USD, short CHF",
    rationale: "HEDGE das posições long em JPY-crosses: se risk-off, JPY aprecia, mas USD e CHF também. Long USD/CHF compensa parcialmente. Fed (5.25%) vs SNB (1.50%) = carry positivo.",
    hedge: "Protege contra risk-off nas posições AUD/JPY e NZD/JPY",
    timeframe: "D1",
    createdAt: new Date().toISOString(), status: "active",
  },
  {
    id: "10", pair: "USD/JPY", symbol: "USDJPY=X", direction: "long",
    entry: 0, target: 0, stop: 0, conviction: "medium",
    label: "Hedge reverso — reduz exposição JPY",
    rationale: "Se long AUD/JPY e NZD/JPY, adicionar small long USD/JPY reduz exposição líquida ao JPY. Fed (5.25%) vs BoJ (0.10%) = maior carry do G10. Cuidado com intervenção BoJ.",
    hedge: "Neutraliza parte do short implícito em JPY das posições de carry",
    timeframe: "D1/4H",
    createdAt: new Date().toISOString(), status: "active",
  },
];

const PAIRS_SYMBOLS: Record<string, string> = {
  "EUR/USD": "EURUSD=X", "GBP/USD": "GBPUSD=X", "USD/JPY": "USDJPY=X",
  "AUD/USD": "AUDUSD=X", "NZD/USD": "NZDUSD=X", "USD/CHF": "USDCHF=X",
  "USD/CAD": "USDCAD=X", "EUR/JPY": "EURJPY=X", "GBP/JPY": "GBPJPY=X",
  "AUD/JPY": "AUDJPY=X", "NZD/JPY": "NZDJPY=X", "CHF/JPY": "CHFJPY=X",
  "EUR/GBP": "EURGBP=X", "EUR/AUD": "EURAUD=X", "EUR/NZD": "EURNZD=X",
  "EUR/CHF": "EURCHF=X", "GBP/CHF": "GBPCHF=X", "GBP/NZD": "GBPNZD=X",
  "AUD/CHF": "AUDCHF=X", "NZD/CHF": "NZDCHF=X", "CAD/JPY": "CADJPY=X",
  "USD/BRL": "BRL=X",
};

function loadIdeas(): ForexIdea[] {
  try {
    const raw = localStorage.getItem("forex_ideas_v2");
    if (raw) return JSON.parse(raw) as ForexIdea[];
  } catch { /* */ }
  return SEED_IDEAS.map(i => ({ ...i }));
}
function saveIdeas(ideas: ForexIdea[]) {
  try { localStorage.setItem("forex_ideas_v2", JSON.stringify(ideas)); } catch { /* */ }
}

function fmtP(v: number, decimals = 4) { return v.toFixed(decimals); }
function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}
function calcRR(direction: string, entry: number, target: number, stop: number) {
  if (!entry || !target || !stop) return null;
  const reward = Math.abs(target - entry);
  const risk = Math.abs(entry - stop);
  if (risk === 0) return null;
  return reward / risk;
}
function pctToTarget(direction: string, entry: number, target: number, current: number) {
  if (!entry || !target || !current) return null;
  const total = Math.abs(target - entry);
  const done = direction === "long" ? current - entry : entry - current;
  if (total === 0) return null;
  return (done / total) * 100;
}
function getCarryDiff(pair: string) {
  const [base, quote] = pair.split("/");
  const b = CARRY_RATES[base] ?? 0;
  const q = CARRY_RATES[quote] ?? 0;
  return b - q;
}

// ─── form padrão ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  pair: "EUR/USD", direction: "long" as "long" | "short",
  entry: "", target: "", stop: "", conviction: "medium" as "high" | "medium",
  label: "", rationale: "", hedge: "", timeframe: "D1/4H",
};

export function ForexIdeasPanel() {
  const [ideas, setIdeas] = useState<ForexIdea[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { setIdeas(loadIdeas()); }, []);

  const fetchPrices = useCallback(async (currentIdeas: ForexIdea[]) => {
    const symbols = [...new Set(currentIdeas.map(i => i.symbol))];
    if (!symbols.length) return;
    try {
      const res = await fetch(`/api/forex/prices?symbols=${symbols.join(",")}`);
      if (res.ok) setPrices(await res.json());
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (ideas.length) fetchPrices(ideas);
    const t = setInterval(() => { if (ideas.length) fetchPrices(ideas); }, 30000);
    return () => clearInterval(t);
  }, [ideas, fetchPrices]);

  function mutate(next: ForexIdea[]) { setIdeas(next); saveIdeas(next); }

  function openEdit(idea: ForexIdea) {
    setEditId(idea.id);
    setForm({
      pair: idea.pair, direction: idea.direction,
      entry: idea.entry ? String(idea.entry) : "",
      target: idea.target ? String(idea.target) : "",
      stop: idea.stop ? String(idea.stop) : "",
      conviction: idea.conviction, label: idea.label,
      rationale: idea.rationale, hedge: idea.hedge ?? "", timeframe: idea.timeframe,
    });
    setShowForm(true);
  }

  function handleSave() {
    const entry = parseFloat(form.entry) || 0;
    const target = parseFloat(form.target) || 0;
    const stop = parseFloat(form.stop) || 0;
    const symbol = PAIRS_SYMBOLS[form.pair] ?? `${form.pair.replace("/", "")}=X`;
    if (editId) {
      mutate(ideas.map(i => i.id === editId ? { ...i, ...form, entry, target, stop, symbol } : i));
    } else {
      const idea: ForexIdea = {
        id: Date.now().toString(), ...form, entry, target, stop, symbol,
        createdAt: new Date().toISOString(), status: "active",
      };
      mutate([...ideas, idea]);
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function handleDelete(id: string) { mutate(ideas.filter(i => i.id !== id)); }
  function toggleStatus(id: string, status: ForexIdea["status"]) {
    mutate(ideas.map(i => i.id === id ? { ...i, status } : i));
  }

  const high = ideas.filter(i => i.conviction === "high" && i.status === "active");
  const medium = ideas.filter(i => i.conviction === "medium" && i.status === "active");
  const closed = ideas.filter(i => i.status !== "active");

  function IdeaCard({ idea }: { idea: ForexIdea }) {
    const p = prices[idea.symbol];
    const current = p?.price ?? 0;
    const rr = calcRR(idea.direction, idea.entry, idea.target, idea.stop);
    const pct = pctToTarget(idea.direction, idea.entry, idea.target, current);
    const carry = getCarryDiff(idea.pair);
    const days = daysSince(idea.createdAt);
    const isExpanded = expanded === idea.id;
    const decimals = idea.pair.includes("JPY") ? 2 : 4;
    const hasPrices = idea.entry > 0 && idea.target > 0 && idea.stop > 0;

    const borderColor = idea.conviction === "high"
      ? "border-l-red-500" : "border-l-yellow-500";
    const convLabel = idea.conviction === "high" ? "ALTA" : "MÉDIA";
    const convColor = idea.conviction === "high" ? "text-red-400" : "text-yellow-400";

    return (
      <div className={`rounded border border-border bg-panel-alt border-l-2 ${borderColor} p-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-text">{idea.pair}</span>
              <span className={`text-xs font-bold ${idea.direction === "long" ? "text-up" : "text-down"}`}>
                {idea.direction === "long" ? "▲ LONG" : "▼ SHORT"}
              </span>
              <span className={`text-xs font-medium ${convColor}`}>{convLabel}</span>
              {idea.hedge && <span className="text-xs text-text-muted border border-border rounded px-1">HEDGE</span>}
              <span className="text-xs text-text-muted">{idea.timeframe}</span>
              <span className="text-xs text-text-muted">{days}d</span>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">{idea.label}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setExpanded(isExpanded ? null : idea.id)}
              className="text-xs text-text-muted hover:text-text">
              {isExpanded ? "fechar" : "ver"}
            </button>
            <button onClick={() => openEdit(idea)}
              className="text-xs text-gold-bright hover:underline">editar</button>
            <button onClick={() => handleDelete(idea.id)}
              className="text-xs text-down hover:underline">×</button>
          </div>
        </div>

        {/* métricas rápidas */}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {hasPrices && (
            <>
              <div className="flex flex-col">
                <span className="text-text-muted">Entrada</span>
                <span className="font-medium text-text">{fmtP(idea.entry, decimals)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-text-muted">Alvo</span>
                <span className="font-medium text-up">{fmtP(idea.target, decimals)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-text-muted">Stop</span>
                <span className="font-medium text-down">{fmtP(idea.stop, decimals)}</span>
              </div>
              {rr !== null && (
                <div className="flex flex-col">
                  <span className="text-text-muted">R:R</span>
                  <span className={`font-medium ${rr >= 2 ? "text-up" : rr >= 1 ? "text-text" : "text-down"}`}>
                    1:{rr.toFixed(1)}
                  </span>
                </div>
              )}
            </>
          )}
          {current > 0 && (
            <div className="flex flex-col">
              <span className="text-text-muted">Atual</span>
              <span className={`font-medium ${p?.changePct && p.changePct >= 0 ? "text-up" : "text-down"}`}>
                {fmtP(current, decimals)}
              </span>
            </div>
          )}
          {pct !== null && (
            <div className="flex flex-col">
              <span className="text-text-muted">% do alvo</span>
              <span className={`font-medium ${pct >= 100 ? "text-up" : pct >= 0 ? "text-up/70" : "text-down"}`}>
                {pct.toFixed(0)}%
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-text-muted">Carry/ano</span>
            <span className={`font-medium ${carry >= 0 ? "text-up" : "text-down"}`}>
              {carry >= 0 ? "+" : ""}{carry.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* barra de progresso */}
        {pct !== null && hasPrices && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-up" : pct >= 0 ? "bg-up/60" : "bg-down/60"}`}
                style={{ width: `${Math.min(100, Math.max(0, pct)).toFixed(0)}%` }}
              />
            </div>
          </div>
        )}

        {!hasPrices && (
          <p className="mt-1.5 text-xs text-yellow-500/80">⚠ Preencha entrada / alvo / stop clicando em editar</p>
        )}

        {isExpanded && (
          <div className="mt-3 border-t border-border/50 pt-3 space-y-2">
            <p className="text-xs text-text-muted leading-relaxed">{idea.rationale}</p>
            {idea.hedge && (
              <p className="text-xs text-text-muted/80 italic">🛡 {idea.hedge}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => toggleStatus(idea.id, "target_hit")}
                className="rounded border border-up/40 px-2 py-0.5 text-xs text-up hover:bg-up/10">
                ✓ Alvo batido
              </button>
              <button onClick={() => toggleStatus(idea.id, "stopped")}
                className="rounded border border-down/40 px-2 py-0.5 text-xs text-down hover:bg-down/10">
                ✗ Stopado
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* cabeçalho + aviso */}
      <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-400/80">
        ⚠ Ideias analíticas com base em carry, tendência e posicionamento COT — não são recomendação de investimento.
        Preencha entrada / alvo / stop com seus preços reais antes de operar.
      </div>

      {/* carry meter */}
      <CarryMeter />

      {/* botão nova ideia */}
      <div className="flex justify-end">
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY_FORM); }}
          className="rounded border border-border bg-panel-alt px-3 py-1.5 text-xs text-gold-bright hover:bg-panel">
          + Nova ideia
        </button>
      </div>

      {/* formulário */}
      {showForm && (
        <div className="rounded border border-border bg-panel-alt p-4">
          <p className="mb-3 text-sm font-medium text-text">{editId ? "Editar ideia" : "Nova ideia"}</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Par</label>
              <select value={form.pair} onChange={e => setForm(f => ({ ...f, pair: e.target.value }))}
                className="rounded border border-border bg-panel px-2 py-1 text-sm text-text">
                {Object.keys(PAIRS_SYMBOLS).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Direção</label>
              <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value as "long" | "short" }))}
                className="rounded border border-border bg-panel px-2 py-1 text-sm text-text">
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            {["entry", "target", "stop"].map(k => (
              <div key={k} className="flex flex-col gap-1">
                <label className="text-xs text-text-muted capitalize">{k === "entry" ? "Entrada" : k === "target" ? "Alvo" : "Stop"}</label>
                <input type="number" step="any"
                  value={form[k as keyof typeof form] as string}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-24 rounded border border-border bg-panel px-2 py-1 text-sm text-text" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Convicção</label>
              <select value={form.conviction} onChange={e => setForm(f => ({ ...f, conviction: e.target.value as "high" | "medium" }))}
                className="rounded border border-border bg-panel px-2 py-1 text-sm text-text">
                <option value="high">Alta (vermelho)</option>
                <option value="medium">Média (amarelo)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Timeframe</label>
              <input value={form.timeframe} onChange={e => setForm(f => ({ ...f, timeframe: e.target.value }))}
                className="w-24 rounded border border-border bg-panel px-2 py-1 text-sm text-text" />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Título curto da ideia"
              className="w-full rounded border border-border bg-panel px-2 py-1 text-sm text-text" />
            <textarea value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
              placeholder="Racional: carry / COT / tendência / catalisador"
              rows={2} className="w-full rounded border border-border bg-panel px-2 py-1 text-sm text-text" />
            <input value={form.hedge} onChange={e => setForm(f => ({ ...f, hedge: e.target.value }))}
              placeholder="Hedge de: (opcional — ex: protege long AUD/JPY)"
              className="w-full rounded border border-border bg-panel px-2 py-1 text-sm text-text" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave}
              className="rounded border border-gold/40 bg-panel px-4 py-1.5 text-sm text-gold-bright hover:bg-panel-alt">
              Salvar
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="rounded border border-border px-4 py-1.5 text-sm text-text-muted hover:text-text">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* alta convicção */}
      {high.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-text">Alta convicção ({high.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {high.map(i => <IdeaCard key={i.id} idea={i} />)}
          </div>
        </div>
      )}

      {/* média convicção */}
      {medium.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <span className="text-sm font-medium text-text">Média convicção ({medium.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {medium.map(i => <IdeaCard key={i.id} idea={i} />)}
          </div>
        </div>
      )}

      {/* encerradas */}
      {closed.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">Encerradas</p>
          <div className="flex flex-col gap-1">
            {closed.map(i => (
              <div key={i.id} className="flex items-center justify-between rounded border border-border/40 px-3 py-1.5 text-xs text-text-muted">
                <span>{i.pair} {i.direction === "long" ? "▲" : "▼"} — {i.status === "target_hit" ? "✓ alvo" : "✗ stop"} — {daysSince(i.createdAt)}d</span>
                <button onClick={() => toggleStatus(i.id, "active")} className="text-gold-bright hover:underline">reativar</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── carry meter ─────────────────────────────────────────────────────────────
function CarryMeter() {
  const pairs = [
    "NZD/JPY", "GBP/JPY", "AUD/JPY", "EUR/JPY", "NZD/CHF",
    "GBP/CHF", "AUD/CHF", "EUR/CHF", "USD/JPY", "USD/CHF",
  ];
  const items = pairs.map(p => {
    const [b, q] = p.split("/");
    const diff = (CARRY_RATES[b] ?? 0) - (CARRY_RATES[q] ?? 0);
    return { pair: p, diff };
  }).sort((a, b) => b.diff - a.diff);

  return (
    <div className="rounded border border-border bg-panel-alt p-3">
      <p className="mb-2 text-xs font-medium text-text-muted">Carry diferencial anual (taxa base dos BCs — verificar após reuniões)</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 md:grid-cols-5">
        {items.map(({ pair, diff }) => (
          <div key={pair} className="flex items-center justify-between text-xs">
            <span className="text-text-muted">{pair}</span>
            <span className={`font-medium ${diff >= 0 ? "text-up" : "text-down"}`}>
              {diff >= 0 ? "+" : ""}{diff.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
