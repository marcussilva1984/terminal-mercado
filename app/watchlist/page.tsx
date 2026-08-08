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

export default async function WatchlistPage() {
  const now = new Date().toISOString();
  const correlations = await getWatchlistCorrelations().catch(() => null);

  const benchmarkCorrelations = hasDatabase()
    ? await getWatchlist()
        .then((items) => getBenchmarkCorrelations(items))
        .catch(() => null)
    : null;

  const conviction = hasDatabase() ? await getConvictionRanking().catch(() => null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Watchlist</h1>
        <p className="mt-1 text-sm text-text-muted">
          Gerencie os papéis/moedas que alimentam z-score e volatilidade sem precisar mexer no código.
        </p>
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
