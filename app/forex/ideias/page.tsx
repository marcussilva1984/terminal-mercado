import { getForexIdeas } from "@/lib/forexIdeas";

export const revalidate = 3600; // refresh once per hour

const BADGE: Record<string, string> = {
  forte: "bg-red-700 text-white",
  medio: "bg-yellow-600 text-white",
  fraco: "bg-zinc-600 text-white",
};

const CARD: Record<string, string> = {
  forte: "bg-red-950 border-red-800",
  medio: "bg-yellow-950 border-yellow-800",
  fraco: "bg-zinc-900 border-zinc-700",
};

export default async function ForexIdeiasPage() {
  const { ideas, updatedAt } = await getForexIdeas();

  const updated = new Date(updatedAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Forex</h1>
        <p className="mt-1 text-sm text-text-muted">
          Força relativa das moedas (diário e semanal) + assimetria de triangulação + viés de carry
          (juros atualizados manualmente em 2026-08-22). Heurística de leitura de fluxo, não recomendação de entrada/saída.
        </p>
      </div>

      <div>
        <h2 className="mb-1 text-base font-semibold text-text">Ideias da semana</h2>
        <p className="mb-4 text-xs text-text-muted">
          Convicção:{" "}
          <span className="font-medium text-red-400">forte</span>
          {" · "}
          <span className="font-medium text-yellow-400">médio</span>
          {" · "}
          <span className="font-medium text-zinc-400">fraco</span>
          {" "}— quanto mais forte, mais os sinais (força, carry, assimetria, tendência) concordam entre si.
        </p>

        {ideas.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nenhum par com alinhamento diário + semanal consistente no momento.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {ideas.map((idea) => (
              <div
                key={idea.pair + idea.label}
                className={`rounded border px-4 py-3 ${CARD[idea.conviction]}`}
              >
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
        )}

        <p className="mt-4 text-xs text-text-muted">
          Atualizado: {updated} · Ideias calculadas automaticamente — não são recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
