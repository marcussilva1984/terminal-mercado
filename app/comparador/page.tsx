import { Panel } from "@/components/Panel";
import { AssetComparator } from "@/components/AssetComparator";

export default function ComparadorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Comparador de Ativos</h1>
        <p className="mt-1 text-sm text-text-muted">
          Compare 2-3 ativos lado a lado — P/L, P/VP, dividend yield, ROE, margem, dívida e mais. Pode
          misturar classes (ex: PETR4 vs VALE3 vs AAPL).
        </p>
      </div>
      <Panel title="Comparação">
        <AssetComparator />
      </Panel>
    </div>
  );
}
