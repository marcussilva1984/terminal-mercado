import { getForexIdeas, CARRY_RATES, CARRY_RATES_DATE } from "@/lib/forexIdeas";

export const revalidate = 3600;

const BADGE: Record<string, string> = {
  forte: "bg-red-700 text-white",
  medio: "bg-yellow-600 text-white",
  fraco: "bg-zinc-600 text-white",
};

const CARD_CARRY = "bg-red-950 border-red-800";
const CARD_NEUTRAL = "bg-zinc-900 border-zinc-700";
const CARD_DISTORTION = "bg-indigo-950 border-indigo-700";
const CARD_HEDGE = "bg-zinc-900 border-zinc-600";

function cardClass(isHedge: boolean, isDistortion: boolean, carryAligned: boolean): string {
  if (isHedge) return CARD_HEDGE;
  if (isDistortion) return CARD_DISTORTION;
  if (carryAligned) return CARD_CARRY;
  return CARD_NEUTRAL;
}

export default async function ForexIdeiasPage() {
  const { ideas, updatedAt } = await getForexIdeas();

  const updated = new Date(updatedAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  // Sort rates high → low for carry table
  const ratesSorted = Object.entries(CARRY_RATES).sort(([, a], [, b]) => b - a);

  const carryIdeas = ideas.filter((i) => i.carryAligned && !i.isHedge && !i.isDistortion);
  const distortionIdeas = ideas.filter((i) => i.isDistortion && !i.isHedge);
  const neutralIdeas = ideas.filter((i) => !i.carryAligned && !i.isDistortion && !i.isHedge);
  const hedgeIdeas = ideas.filter((i) => i.isHedge);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Forex</h1>
        <p className="mt-1 text-sm text-text-muted">
          Força relativa das moedas (diário e semanal) + viés de carry + distorções técnicas.
          Heurística de leitura de fluxo, não recomendação de entrada/saída.
        </p>
      </div>

      {/* Carry table */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-text">Taxas de juros dos bancos centrais (G8)</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ratesSorted.map(([ccy, rate]) => (
            <div key={ccy} className="rounded border border-border bg-panel-alt px-2 py-2 text-center">
              <div className="text-xs font-medium text-text-muted">{ccy}</div>
              <div className={`text-sm font-semibold tabular-nums ${rate >= 3 ? "text-up" : rate <= 0.5 ? "text-down" : "text-text"}`}>
                {rate.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Taxas atualizadas em {CARRY_RATES_DATE}. Carry = taxa base − taxa quote. Quanto maior o diferencial, maior o swap recebido ao carregar a posição.
        </p>
      </div>

      {/* Ideas */}
      <div>
        <h2 className="mb-1 text-base font-semibold text-text">Ideias da semana</h2>
        <p className="mb-4 text-xs text-text-muted">
          Convicção:{" "}
          <span className="font-medium text-red-400">forte</span>
          {" · "}
          <span className="font-medium text-yellow-400">médio</span>
          {" · "}
          <span className="font-medium text-zinc-400">fraco</span>
          {" — "}
          <span className="text-red-300">■</span> carry alinhado {" · "}
          <span className="text-indigo-400">■</span> distorção técnica {" · "}
          <span className="text-zinc-400">■</span> tendência/hedge
        </p>

        {ideas.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nenhum par com alinhamento diário + semanal consistente no momento.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Carry-aligned section */}
            {carryIdeas.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-400">
                  ↑ Carry positivo + tendência alinhada — prioridade
                </p>
                <div className="flex flex-col gap-2">
                  {carryIdeas.map((idea) => (
                    <div key={idea.pair + idea.label} className={`rounded border px-4 py-3 ${cardClass(false, false, true)}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${BADGE[idea.conviction]}`}>
                          {idea.conviction}
                        </span>
                        <span className="text-sm font-semibold text-text">{idea.label}</span>
                      </div>
                      <p className="mt-1 pl-9 text-sm text-text-muted">{idea.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Neutral section */}
            {neutralIdeas.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  → Tendência técnica (carry neutro/negativo)
                </p>
                <div className="flex flex-col gap-2">
                  {neutralIdeas.map((idea) => (
                    <div key={idea.pair + idea.label} className={`rounded border px-4 py-3 ${CARD_NEUTRAL}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${BADGE[idea.conviction]}`}>
                          {idea.conviction}
                        </span>
                        <span className="text-sm font-semibold text-text">{idea.label}</span>
                      </div>
                      <p className="mt-1 pl-9 text-sm text-text-muted">{idea.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Distortion section */}
            {distortionIdeas.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-indigo-400">
                  ⚡ Distorção — carry favorável mas preço descontado (mean reversion)
                </p>
                <div className="flex flex-col gap-2">
                  {distortionIdeas.map((idea) => (
                    <div key={idea.pair + idea.label} className={`rounded border px-4 py-3 ${CARD_DISTORTION}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${BADGE[idea.conviction]}`}>
                          {idea.conviction}
                        </span>
                        <span className="text-sm font-semibold text-text">{idea.label}</span>
                      </div>
                      <p className="mt-1 pl-9 text-sm text-text-muted">{idea.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hedges section */}
            {hedgeIdeas.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  ⟺ Hedges sugeridos — diversificação de moeda
                </p>
                <div className="flex flex-col gap-2">
                  {hedgeIdeas.map((idea) => (
                    <div key={idea.pair + idea.label} className={`rounded border px-4 py-3 ${CARD_HEDGE}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${BADGE[idea.conviction]}`}>
                          {idea.conviction}
                        </span>
                        <span className="text-sm font-semibold text-text">{idea.label}</span>
                      </div>
                      <p className="mt-1 pl-9 text-sm text-text-muted">{idea.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-text-muted">
          Atualizado: {updated} · Ideias calculadas automaticamente — não são recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
