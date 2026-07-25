import { Panel } from "@/components/Panel";
import { NewsBoard } from "@/components/NewsBoard";
import { getAllNewsWithCategory } from "@/lib/sources/rss";

export const dynamic = "force-dynamic";

export default async function NoticiasPage() {
  const now = new Date().toISOString();
  const items = await getAllNewsWithCategory(80).catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Notícias</h1>
        <p className="mt-1 text-sm text-text-muted">
          Agregado de todas as fontes (B3, Cripto, Internacional, Forex, FII e Geral). Filtre por
          categoria abaixo.
        </p>
      </div>

      <Panel title="Todas as Fontes" updatedAt={now}>
        <NewsBoard items={items} now={now} />
      </Panel>
    </div>
  );
}
