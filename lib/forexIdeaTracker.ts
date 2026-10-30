import { refreshPolicyRatesFromCalendar } from "@/lib/forexRates";
import { getForexIdeas, fetchDailyBars, formatFx } from "@/lib/forexIdeas";
import { getTrackedIdeas, openTrackedIdea, closeTrackedIdea, type TrackedStatus } from "@/lib/db/forexIdeaRepo";

export const MAX_DAYS_OPEN = 30;

export interface TrackerEvent {
  key: string;
  label: string;
}

function signedR(r: number): string {
  return `${r >= 0 ? "+" : ""}${r.toFixed(1)}R`;
}

// Ordem importa: juros primeiro (as ideias usam o carry), depois fecha o que
// bateu stop/alvo, por último abre as ideias fortes novas.
export async function runForexIdeaTracker(): Promise<TrackerEvent[]> {
  const events: TrackerEvent[] = [];

  const changes = await refreshPolicyRatesFromCalendar().catch((e) => {
    console.error("Atualização de juros pelo calendário falhou:", e);
    return [];
  });
  for (const c of changes) {
    const from = c.from === null ? "—" : `${c.from.toFixed(2)}%`;
    const note = c.status === "estimado" ? "consenso da reunião, aguardando confirmação" : "confirmado";
    events.push({
      key: `forex:rate:${c.currency}:${c.to}`,
      label: `🏦 Juros ${c.currency}: ${from} → ${c.to.toFixed(2)}% (${note}). Carry das ideias forex já recalculado.`,
    });
  }

  const tracked = await getTrackedIdeas();
  for (const t of tracked.filter((i) => i.status === "aberta")) {
    const bars = await fetchDailyBars(t.symbol);
    const openedDate = t.openedAt.slice(0, 10);
    const after = bars.filter((b) => b.date > openedDate);
    const long = t.direction === "alta";

    let outcome: { status: Exclude<TrackedStatus, "aberta">; exit: number } | null = null;
    for (const b of after) {
      const hitStop = long ? b.low <= t.stop : b.high >= t.stop;
      const hitTarget = long ? b.high >= t.target : b.low <= t.target;
      // Stop e alvo no mesmo candle diário: conta stop (sem intraday não dá pra saber a ordem).
      if (hitStop) {
        outcome = { status: "stop", exit: t.stop };
        break;
      }
      if (hitTarget) {
        outcome = { status: "alvo", exit: t.target };
        break;
      }
    }

    const daysOpen = Math.floor((Date.now() - new Date(t.openedAt).getTime()) / 86_400_000);
    if (!outcome && daysOpen >= MAX_DAYS_OPEN && after.length > 0) {
      outcome = { status: "expirada", exit: after[after.length - 1].close };
    }
    if (!outcome) continue;

    const risk = Math.abs(t.entry - t.stop);
    const r = ((outcome.exit - t.entry) / risk) * (long ? 1 : -1);
    await closeTrackedIdea(t.id, outcome.status, outcome.exit, r);

    const verb =
      outcome.status === "alvo"
        ? `✅ ${t.pair} (${t.direction}) bateu o ALVO`
        : outcome.status === "stop"
          ? `❌ ${t.pair} (${t.direction}) bateu o STOP`
          : `⌛ ${t.pair} (${t.direction}) expirou sem stop nem alvo`;
    events.push({
      key: `forex:idea:close:${t.id}`,
      label: `${verb} após ${daysOpen} dias — ${signedR(r)}. Saída ${formatFx(t.pair, outcome.exit)}.`,
    });
  }

  const { ideas } = await getForexIdeas();
  for (const idea of ideas) {
    if (idea.isHedge || idea.kind === "distorcao" || idea.conviction !== "forte" || !idea.levels) continue;
    const lv = idea.levels;
    const opened = await openTrackedIdea({
      pair: idea.pair,
      symbol: idea.symbol,
      direction: lv.side,
      conviction: idea.conviction,
      kind: idea.kind,
      entry: lv.entry,
      stop: lv.stop,
      target: lv.target,
    });
    if (!opened) continue;

    const carry = lv.carryPipsPerDay;
    const carryNote = Math.abs(carry) >= 0.05 ? ` Carry ≈ ${carry > 0 ? "+" : ""}${carry.toFixed(1)} pips/dia (bruto).` : "";
    events.push({
      key: `forex:idea:open:${opened.id}`,
      label:
        `🎯 Nova ideia FORTE: ${idea.pair} ${lv.side} — entrada ${formatFx(idea.pair, lv.entry)}, ` +
        `stop ${formatFx(idea.pair, lv.stop)} (${Math.round(lv.stopPips)} pips), alvo ${formatFx(idea.pair, lv.target)} ` +
        `(${Math.round(lv.targetPips)} pips), R:R 2:1.${carryNote} Heurística, não recomendação.`,
    });
  }

  return events;
}
