import { getForexIdeas, currencyExposure, type ForexIdea } from "@/lib/forexIdeas";
import { getTrackedIdeas, type TrackedIdea } from "@/lib/db/forexIdeaRepo";
import { ForexRatesTable } from "@/components/ForexRatesTable";
import { ForexCotPanel } from "@/components/ForexCotPanel";
import { ForexIdeaCard } from "@/components/ForexIdeaCard";
import { ForexScoreboard } from "@/components/ForexScoreboard";

export const revalidate = 3600;

function Section({
  title,
  className,
  ideas,
  openByKey,
  now,
}: {
  title: string;
  className: string;
  ideas: ForexIdea[];
  openByKey: Map<string, TrackedIdea>;
  now: number;
}) {
  if (ideas.length === 0) return null;
  return (
    <div>
      <p className={`mb-2 text-xs font-medium uppercase tracking-wide ${className}`}>{title}</p>
      <div className="flex flex-col gap-2">
        {ideas.map((idea) => (
          <ForexIdeaCard
            key={idea.pair + idea.label}
            idea={idea}
            tracked={idea.levels ? openByKey.get(`${idea.pair}:${idea.levels.side}`) : undefined}
            now={now}
          />
        ))}
      </div>
    </div>
  );
}

export default async function ForexIdeiasPage() {
  const [{ ideas, prices, rates, cot, updatedAt }, tracked] = await Promise.all([
    getForexIdeas(),
    getTrackedIdeas().catch(() => [] as TrackedIdea[]),
  ]);

  const now = new Date(updatedAt).getTime();
  const openByKey = new Map(tracked.filter((t) => t.status === "aberta").map((t) => [`${t.pair}:${t.direction}`, t]));

  const updated = new Date(updatedAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const main = ideas.filter((i) => !i.isHedge);
  const forteCount = main.filter((i) => i.conviction === "forte" && i.levels).length;
  const concentrated = Object.entries(currencyExposure(ideas))
    .filter(([, n]) => Math.abs(n) >= 3)
    .map(([ccy, n]) => `${Math.abs(n)} ${n > 0 ? "compram" : "vendem"} ${ccy}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ideias Forex</h1>
        <p className="mt-1 text-sm text-text-muted">
          Swing trade no diário: força relativa (diário e semanal) + carry pelos juros reais dos bancos centrais +
          posicionamento COT + stop/alvo pela volatilidade (ATR). Heurística de leitura de fluxo, não recomendação de
          entrada/saída.
        </p>
      </div>

      <ForexRatesTable rates={rates} />
      <ForexCotPanel positions={cot} />

      <div>
        <h2 className="mb-1 text-base font-semibold text-text">Ideias da semana</h2>
        <p className="mb-4 text-xs text-text-muted">
          Convicção: <span className="font-medium text-red-400">forte</span> ·{" "}
          <span className="font-medium text-yellow-400">médio</span> · <span className="font-medium text-zinc-400">fraco</span>{" "}
          — sobe quando tendência, carry e COT concordam; cai quando o COT está lotado. Stop = 1,5× ATR(14), alvo = 3× ATR(14).
          Swap estimado é bruto — cada corretora cobra sua própria taxa.
        </p>

        {concentrated.length > 0 && (
          <p className="mb-4 rounded border border-yellow-700 bg-yellow-950/40 px-3 py-2 text-xs text-yellow-300">
            ⚠ Concentração: das {forteCount} ideias fortes, {concentrated.join(" e ")}. Na prática é uma aposta só
            nessa moeda — se for operar mais de uma, reduza o lote de cada ou escolha uma por moeda.
          </p>
        )}

        {ideas.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum par com alinhamento diário + semanal consistente no momento.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <Section
              title="↑ Carry positivo + tendência alinhada — prioridade"
              className="text-red-400"
              ideas={main.filter((i) => i.kind === "carry")}
              openByKey={openByKey}
              now={now}
            />
            <Section
              title="→ Tendência técnica (carry neutro ou contra)"
              className="text-zinc-400"
              ideas={main.filter((i) => i.kind === "neutro")}
              openByKey={openByKey}
              now={now}
            />
            <Section
              title="⚡ Distorção — preço descontado contra o carry (esperar reversão)"
              className="text-indigo-400"
              ideas={main.filter((i) => i.kind === "distorcao")}
              openByKey={openByKey}
              now={now}
            />
            <Section
              title="⟺ Hedges sugeridos — diversificação de moeda"
              className="text-zinc-400"
              ideas={ideas.filter((i) => i.isHedge)}
              openByKey={openByKey}
              now={now}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-text-muted">
          Atualizado: {updated} (recalcula a cada hora) · Ideias calculadas automaticamente — não são recomendação de
          investimento.
        </p>
      </div>

      <ForexScoreboard tracked={tracked} prices={prices} now={now} />
    </div>
  );
}
