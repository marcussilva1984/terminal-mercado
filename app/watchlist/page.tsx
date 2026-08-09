import { Panel } from "@/components/Panel";
import { WatchlistManager } from "@/components/WatchlistManager";
import { CorrelationTable } from "@/components/CorrelationTable";
import { BenchmarkCorrelationTable } from "@/components/BenchmarkCorrelationTable";
import { getWatchlistCorrelations, getBenchmarkCorrelations } from "@/lib/correlationService";
import { getConvictionRanking } from "@/lib/convictionService";
import { ConvictionRankingList } from "@/components/ConvictionRankingList";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const RESUMO_MAX_ITEMS = 30;

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const isCompleto = scope === "completo";
  const maxItems = isCompleto ? undefined : RESUMO_MAX_ITEMS;

  const now = new Date().toISOString();
  const correlations = await getWatchlistCorrelations(15, maxItems).catch(() => null);

  const benchmarkCorrelations = hasDatabase()
    ? await getWatchlist()
        .then((items) => getBenchmarkCorrelations(maxItems ? items.slice(0, maxItems) : items))
        .catch(() => null)
    : null;

  const conviction = hasDatabase() ? await getConvictionRanking().catch(() => null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">Watchlist</h1>
          <p className="mt-1 text-sm text-text-muted">
            Gerencie os papéis/moedas que alimentam z-score e volatilidade sem precisar mexer no
            código.
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded border border-border p-0.5 text-xs">
          <a
            href="/watchlist"
            className={`rounded px-2 py-1 ${!isCompleto ? "bg-panel-alt text-gold-bright" : "text-text-muted hover:text-text"}`}
          >
            Resumido (top {RESUMO_MAX_ITEMS})
          </a>
          <a
            href="/watchlist?scope=completo"
            className={`rounded px-2 py-1 ${isCompleto ? "bg-panel-alt text-gold-bright" : "text-text-muted hover:text-text"}`}
          >
            Completo
          </a>
        </div>
      </div>
      <WatchlistManager />

      <Panel title="Ranking de Convicção" updatedAt={now}>
        {conviction ? (
          <ConvictionRankingList items={conviction} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar este ranking.
          </p>
        )}
      </Panel>

      <Panel title="Correlação entre Ativos" updatedAt={now}>
        {correlations ? (
          <CorrelationTable items={correlations} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar a correlação.
          </p>
        )}
      </Panel>

      <Panel title="Correlação e Beta vs. Benchmarks (IBOV / S&P 500 / DXY)" updatedAt={now}>
        {benchmarkCorrelations ? (
          <BenchmarkCorrelationTable items={benchmarkCorrelations} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar esta comparação.
          </p>
        )}
      </Panel>
    </div>
  );
}
