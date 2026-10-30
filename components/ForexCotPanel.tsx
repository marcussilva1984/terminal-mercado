import type { CotPosition } from "@/lib/sources/cot";

function formatContracts(n: number): string {
  const abs = Math.abs(n);
  const v = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : String(abs);
  return `${n < 0 ? "−" : n > 0 ? "+" : ""}${v}`;
}

export function ForexCotPanel({ positions }: { positions: CotPosition[] }) {
  if (positions.length === 0) {
    return <p className="text-sm text-text-muted">Relatório COT da CFTC indisponível no momento.</p>;
  }

  const sorted = [...positions].sort((a, b) => b.cotIndex - a.cotIndex);
  const reportDate = new Date(`${sorted[0].reportDate}T12:00:00Z`).toLocaleDateString("pt-BR");

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold text-text">Posicionamento dos especuladores (COT / CFTC)</h2>
      <div className="flex flex-col gap-1.5">
        {sorted.map((p) => {
          const crowdedLong = p.cotIndex >= 80;
          const crowdedShort = p.cotIndex <= 20;
          const barColor = crowdedLong ? "bg-down" : crowdedShort ? "bg-up" : "bg-gold";
          return (
            <div key={p.currency} className="flex items-center gap-2 text-xs">
              <span className="w-9 shrink-0 font-medium text-text">{p.currency}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded bg-panel-alt">
                <div className="absolute inset-y-0 left-[20%] w-px bg-border" />
                <div className="absolute inset-y-0 left-[80%] w-px bg-border" />
                <div className={`absolute inset-y-0 left-0 ${barColor} opacity-80`} style={{ width: `${Math.max(p.cotIndex, 2)}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-text">{Math.round(p.cotIndex)}</span>
              <span className="hidden w-16 shrink-0 text-right tabular-nums text-text-muted sm:inline" title="Posição líquida (contratos)">
                {formatContracts(p.net)}
              </span>
              <span
                className={`w-14 shrink-0 text-right tabular-nums ${p.netChange >= 0 ? "text-up" : "text-down"}`}
                title="Variação na semana"
              >
                {formatContracts(p.netChange)}
              </span>
              <span className="hidden w-24 shrink-0 text-text-muted md:inline">
                {crowdedLong ? "lotado comprado" : crowdedShort ? "lotado vendido" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Índice COT 0–100 = onde a posição líquida dos especuladores está no range das últimas 52 semanas. Acima de 80 =
        lotado comprado (pouca gente sobrando pra comprar); abaixo de 20 = lotado vendido. Colunas: índice · posição
        líquida · variação na semana. Relatório de {reportDate} (sai às sextas com dados de terça). USD = contrato do
        índice dólar (ICE).
      </p>
    </div>
  );
}
