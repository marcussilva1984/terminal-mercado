import Link from "next/link";
import { Panel } from "@/components/Panel";
import { NewsBoard } from "@/components/NewsBoard";
import { getAllNewsWithCategory } from "@/lib/sources/rss";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";

export const revalidate = 240;

export default async function NoticiasPage() {
  const now = new Date().toISOString();
  const [items, watchlist] = await Promise.all([
    getAllNewsWithCategory(80).catch(() => []),
    hasDatabase() ? getWatchlist().catch(() => []) : Promise.resolve([]),
  ]);
  const watchlistSymbols = watchlist.map((w) => w.symbol);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Notícias</h1>
          <p className="mt-1 text-sm text-text-muted">
            Agregado de todas as fontes (B3, Cripto, Internacional, Forex, FII e Geral). Filtre por
            categoria abaixo.
          </p>
        </div>
        <Link
          href="/alertas"
          className="shrink-0 rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
        >
          Ver Alertas →
        </Link>
      </div>

      <Panel title="Todas as Fontes" updatedAt={now}>
        <NewsBoard items={items} now={now} watchlistSymbols={watchlistSymbols} />
      </Panel>
    </div>
  );
}
