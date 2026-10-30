import { formatFx, STOP_ATR, TARGET_ATR, type ForexIdea, type CotNote } from "@/lib/forexIdeas";
import type { TrackedIdea } from "@/lib/db/forexIdeaRepo";

const BADGE: Record<ForexIdea["conviction"], string> = {
  forte: "bg-red-700 text-white",
  medio: "bg-yellow-600 text-white",
  fraco: "bg-zinc-600 text-white",
};

function cardClass(idea: ForexIdea): string {
  if (idea.isHedge) return "bg-zinc-900 border-zinc-600";
  if (idea.kind === "distorcao") return "bg-indigo-950 border-indigo-700";
  if (idea.kind === "carry") return "bg-red-950 border-red-800";
  return "bg-zinc-900 border-zinc-700";
}

function describeIndex(ccy: string, index: number): string {
  const where = index >= 80 ? "especuladores comprados no extremo" : index <= 20 ? "especuladores vendidos no extremo" : "posição média";
  return `${ccy} ${Math.round(index)} (${where})`;
}

function cotText(cot: CotNote): { text: string; className: string } {
  const parts = [
    cot.buyIndex !== undefined ? `compra ${describeIndex(cot.buyCcy, cot.buyIndex)}` : null,
    cot.sellIndex !== undefined ? `venda ${describeIndex(cot.sellCcy, cot.sellIndex)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (cot.verdict === "lotado") {
    return {
      text: `COT lotado — a multidão já está desse lado: ${parts}. Pouca gente sobrando pra empurrar: convicção reduzida.`,
      className: "text-down",
    };
  }
  if (cot.verdict === "espaco") {
    return {
      text: `COT a favor — a multidão está do lado oposto: ${parts}. Se ela desmontar, empurra o preço pro seu lado (assimetria).`,
      className: "text-up",
    };
  }
  return { text: `COT neutro — ${parts}.`, className: "text-text-muted" };
}

export function ForexIdeaCard({ idea, tracked, now }: { idea: ForexIdea; tracked?: TrackedIdea; now: number }) {
  const lv = idea.levels;
  const cot = idea.cot ? cotText(idea.cot) : null;
  const daysTracked = tracked ? Math.floor((now - new Date(tracked.openedAt).getTime()) / 86_400_000) : null;

  return (
    <div className={`rounded border px-4 py-3 ${cardClass(idea)}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${BADGE[idea.conviction]}`}>
          {idea.conviction}
        </span>
        <span className="text-sm font-semibold text-text">{idea.label}</span>
      </div>
      <div className="mt-1 flex flex-col gap-1 pl-9 text-sm">
        <p className="text-text-muted">{idea.rationale}</p>

        {lv && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
            <span className="text-text-muted">
              {lv.side === "alta" ? "Compra" : "Venda"} ref. <span className="text-text">{formatFx(idea.pair, lv.entry)}</span>
            </span>
            <span className="text-down">
              Stop {formatFx(idea.pair, lv.stop)} ({Math.round(lv.stopPips)} pips)
            </span>
            <span className="text-up">
              Alvo {formatFx(idea.pair, lv.target)} ({Math.round(lv.targetPips)} pips)
            </span>
            <span className="text-text-muted">R:R {(TARGET_ATR / STOP_ATR).toFixed(0)}:1</span>
            {Math.abs(lv.carryPipsPerDay) >= 0.05 && (
              <span className={lv.carryPipsPerDay > 0 ? "text-up" : "text-down"} title="Bruto, antes da taxa/markup da corretora">
                Swap ≈ {lv.carryPipsPerDay > 0 ? "+" : ""}
                {lv.carryPipsPerDay.toFixed(1)} pips/dia
              </span>
            )}
          </div>
        )}

        {cot && <p className={`text-xs ${cot.className}`}>{cot.text}</p>}

        {tracked && daysTracked !== null && (
          <p className="text-xs text-gold-bright">
            ● No placar há {daysTracked === 0 ? "menos de 1 dia" : `${daysTracked} ${daysTracked === 1 ? "dia" : "dias"}`} (entrada{" "}
            {formatFx(tracked.pair, tracked.entry)})
          </p>
        )}
      </div>
    </div>
  );
}
