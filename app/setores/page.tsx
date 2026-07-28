import { Panel } from "@/components/Panel";
import { SectorGroups } from "@/components/SectorGroups";
import { getB3SectorGroups } from "@/lib/sources/brapi";

export const dynamic = "force-dynamic";

export default async function SetoresPage() {
  const now = new Date().toISOString();
  const groups = await getB3SectorGroups().catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Setores B3</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ações agrupadas por setor (via brapi.dev), ordenadas por variação média do dia — clique num
          setor pra ver quem está mais barato/caro dentro dele mesmo (não com o mercado inteiro).
        </p>
      </div>
      <Panel title="Desempenho por Setor" updatedAt={now}>
        {groups ? (
          <SectorGroups groups={groups} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>
    </div>
  );
}
