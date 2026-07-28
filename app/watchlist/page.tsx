import { Panel } from "@/components/Panel";
import { WatchlistManager } from "@/components/WatchlistManager";
import { CorrelationTable } from "@/components/CorrelationTable";
import { getWatchlistCorrelations } from "@/lib/correlationService";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const now = new Date().toISOString();
  const correlations = await getWatchlistCorrelations().catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Watchlist</h1>
        <p className="mt-1 text-sm text-text-muted">
          Gerencie os papéis/moedas que alimentam z-score e volatilidade sem precisar mexer no código.
        </p>
      </div>
      <WatchlistManager />

      <Panel title="Correlação entre Ativos" updatedAt={now}>
        {correlations ? (
          <CorrelationTable items={correlations} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar a correlação.
          </p>
        )}
      </Panel>
    </div>
  );
}
