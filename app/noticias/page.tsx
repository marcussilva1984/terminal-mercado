import { Panel } from "@/components/Panel";
import { NewsBoard } from "@/components/NewsBoard";
import { getAllNewsWithCategory } from "@/lib/sources/rss";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function NoticiasPage() {
  const now = new Date().toISOString();
  const [items, watchlist] = await Promise.all([
    getAllNewsWithCategory(80).catch(() => []),
    hasDatabase() ? getWatchlist().catch(() => []) : Promise.resolve([]),
  ]);
  const watchlistSymbols = watchlist.map((w) => w.symbol);

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
        <NewsBoard items={items} now={now} watchlistSymbols={watchlistSymbols} />
      </Panel>
    </div>
  );
}
