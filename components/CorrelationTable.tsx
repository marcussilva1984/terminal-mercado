import type { CorrelationPair } from "@/lib/correlationService";

function toneClass(correlation: number): string {
  const abs = Math.abs(correlation);
  if (abs >= 0.7) return correlation > 0 ? "text-down" : "text-up";
  if (abs >= 0.4) return "text-amber";
  return "text-text-muted";
}

export function CorrelationTable({ items }: { items: CorrelationPair[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Sem histórico suficiente ainda entre pares de ativos — precisa de alguns dias de coleta via
        cron pra calcular correlação.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="pb-2 font-medium">Par</th>
            <th className="pb-2 font-medium text-right">Correlação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 text-text">
                {p.symbolA} <span className="text-text-muted">×</span> {p.symbolB}
              </td>
              <td className={`py-1.5 text-right font-medium ${toneClass(p.correlation)}`}>{p.correlation.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Correlação dos retornos diários (Pearson), de -1 a 1. Perto de 1 = andam juntos (vermelho, pouca
        diversificação); perto de -1 = andam opostos (verde); perto de 0 = sem relação clara.
      </p>
    </div>
  );
}
