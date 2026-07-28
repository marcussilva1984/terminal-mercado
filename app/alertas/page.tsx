import { Panel } from "@/components/Panel";
import { AlertStatusList } from "@/components/AlertStatusList";
import { getRecentAlerts } from "@/lib/db/alertRepo";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const now = new Date().toISOString();
  const alerts = await getRecentAlerts(24 * 30, 200).catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Histórico de Alertas</h1>
        <p className="mt-1 text-sm text-text-muted">
          Últimos 200 alertas enviados (fluxo B3, z-score, watchlist, preço-alvo, fatos relevantes),
          últimos 30 dias — o mesmo que vai pro Telegram quando o bot está configurado.
        </p>
      </div>

      <Panel title="Alertas" updatedAt={now}>
        {alerts ? (
          <AlertStatusList alerts={alerts} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> para habilitar o histórico de alertas.
          </p>
        )}
      </Panel>
    </div>
  );
}
