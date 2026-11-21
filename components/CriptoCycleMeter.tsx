import type { GlobalCryptoData } from "@/lib/sources/coingecko";
import type { OnChainSnapshot, FearGreedPoint } from "@/lib/sources/onchain";
import type { DerivativeSnapshot } from "@/lib/sources/cryptoDerivatives";
import { formatCompact } from "@/lib/format";

type Sinal = "verde" | "amarelo" | "vermelho" | "neutro";

function dot(s: Sinal) {
  const cls =
    s === "verde" ? "bg-up" :
    s === "vermelho" ? "bg-down" :
    s === "amarelo" ? "bg-amber-400" : "bg-border";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls} shrink-0`} />;
}

interface Row {
  label: string;
  value: string;
  note: string;
  sinal: Sinal;
}

function buildRows(
  global: GlobalCryptoData | null,
  onChain: OnChainSnapshot[],
  fearGreed: FearGreedPoint | null,
  derivatives: DerivativeSnapshot[],
): Row[] {
  const rows: Row[] = [];

  // 1. Fear & Greed
  if (fearGreed) {
    const s: Sinal =
      fearGreed.value <= 25 ? "verde" :
      fearGreed.value >= 75 ? "vermelho" : "amarelo";
    rows.push({
      label: "Fear & Greed",
      value: `${fearGreed.value} — ${fearGreed.classification}`,
      note: fearGreed.value <= 25 ? "medo extremo = zona de compra histórica"
          : fearGreed.value >= 75 ? "ganância extrema = cuidado com topo"
          : "sentimento neutro",
      sinal: s,
    });
  }

  // 2. MVRV BTC
  const btcOnChain = onChain.find((o) => o.asset === "BTC");
  if (btcOnChain?.mvrv !== null && btcOnChain?.mvrv !== undefined) {
    const s: Sinal =
      btcOnChain.mvrv <= 1 ? "verde" :
      btcOnChain.mvrv >= 3.5 ? "vermelho" : "amarelo";
    rows.push({
      label: "MVRV BTC",
      value: btcOnChain.mvrv.toFixed(2),
      note:
        btcOnChain.mvrv <= 1 ? "< 1 = fundo histórico de ciclo" :
        btcOnChain.mvrv >= 3.5 ? "≥ 3.5 = zona de topo histórico" :
        "zona intermediária de ciclo",
      sinal: s,
    });
  }

  // 3. Dominância BTC
  if (global) {
    const d = global.btcDominance;
    // Dominância alta + subindo = capital em BTC (antes de altseason)
    // Dominância baixa = altseason em curso
    const s: Sinal = d >= 55 ? "amarelo" : d <= 42 ? "verde" : "neutro";
    rows.push({
      label: "Dominância BTC",
      value: `${d.toFixed(1)}%`,
      note:
        d >= 55 ? "BTC dominando — altseason ainda longe" :
        d <= 42 ? "altseason em curso — alts se movem mais" :
        "transição — acompanhe o fluxo para alts",
      sinal: s,
    });
  }

  // 4. Funding rate médio (perpétuos Binance)
  if (derivatives.length > 0) {
    const avgFunding = derivatives.reduce((s, d) => s + d.fundingRatePct, 0) / derivatives.length;
    const s: Sinal =
      avgFunding >= 0.05 ? "vermelho" :
      avgFunding <= -0.02 ? "verde" : "neutro";
    rows.push({
      label: "Funding Rate médio",
      value: `${avgFunding.toFixed(4)}%`,
      note:
        avgFunding >= 0.05 ? "mercado muito comprado — risco de cascata de liquidação" :
        avgFunding <= -0.02 ? "shorts dominando — risco de short squeeze" :
        "posicionamento neutro nos perpétuos",
      sinal: s,
    });
  }

  // 5. Market cap total + variação
  if (global) {
    const ch = global.marketCapChangePercent24h;
    const s: Sinal = ch >= 3 ? "verde" : ch <= -3 ? "vermelho" : "neutro";
    rows.push({
      label: "Market Cap Total",
      value: `${formatCompact(global.totalMarketCapUsd, "US$")} (${ch >= 0 ? "+" : ""}${ch.toFixed(1)}% 24h)`,
      note: ch >= 3 ? "forte entrada de capital hoje" : ch <= -3 ? "saída de capital hoje" : "mercado lateral",
      sinal: s,
    });
  }

  return rows;
}

export function CriptoCycleMeter({
  global,
  onChain,
  fearGreed,
  derivatives,
}: {
  global: GlobalCryptoData | null;
  onChain: OnChainSnapshot[];
  fearGreed: FearGreedPoint | null;
  derivatives: DerivativeSnapshot[];
}) {
  const rows = buildRows(global, onChain, fearGreed, derivatives);

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">Fontes indisponíveis no momento.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="mt-0.5">{dot(r.sinal)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{r.label}</span>
              <span className="text-sm font-semibold tabular-nums text-text shrink-0">{r.value}</span>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">{r.note}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
