import type { BenchmarkCorrelation } from "@/lib/correlationService";

function toneClass(correlation: number): string {
  const abs = Math.abs(correlation);
  if (abs >= 0.7) return correlation > 0 ? "text-down" : "text-up";
  if (abs >= 0.4) return "text-amber";
  return "text-text-muted";
}

export function BenchmarkCorrelationTable({ items }: { items: BenchmarkCorrelation[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Sem histórico suficiente ainda contra os benchmarks — precisa de alguns dias de coleta via
        cron pra calcular.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-muted">
            <th className="pb-2 font-medium">Ativo</th>
            <th className="pb-2 font-medium">Benchmark</th>
            <th className="pb-2 font-medium text-right">Correlação</th>
            <th className="pb-2 font-medium text-right">Beta</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 text-text">{p.symbol}</td>
              <td className="py-1.5 text-text-muted">{p.benchmark}</td>
              <td className={`py-1.5 text-right font-medium ${toneClass(p.correlation)}`}>{p.correlation.toFixed(2)}</td>
              <td className="py-1.5 text-right text-text">{p.beta.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Beta {">"} 1 = se move mais que o benchmark (mais agressivo); beta {"<"} 1 = se move menos.
        Correlação de -1 a 1 (Pearson dos retornos diários).
      </p>
    </div>
  );
}
