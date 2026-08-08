import { Panel } from "@/components/Panel";
import { AlertStatusList } from "@/components/AlertStatusList";
import { getRecentAlerts } from "@/lib/db/alertRepo";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";
import { classifyAlert, type AlertCategory } from "@/lib/alertCategory";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: AlertCategory[] = ["Oportunidades", "Ações", "Cripto", "Stocks", "FII", "Outros"];

export default async function AlertasPage() {
  const now = new Date().toISOString();

  if (!hasDatabase()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-text">Alertas</h1>
        <Panel title="Alertas" updatedAt={now}>
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> para habilitar o histórico de alertas.
          </p>
        </Panel>
      </div>
    );
  }

  const [alerts, watchlist] = await Promise.all([
    getRecentAlerts(24 * 30, 500, { excludeKinds: ["noticia", "fato_relevante"] }).catch(() => []),
    getWatchlist().catch(() => []),
  ]);

  const grouped = new Map<AlertCategory, typeof alerts>();
  for (const alert of alerts) {
    const category = classifyAlert(alert, watchlist);
    const list = grouped.get(category) ?? [];
    list.push(alert);
    grouped.set(category, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Alertas</h1>
        <p className="mt-1 text-sm text-text-muted">
          Espelho de tudo que já foi (ou seria) enviado pro Telegram, agrupado por categoria — útil
          pra conferir aqui quando você não está com o celular por perto. Últimos 30 dias. Notícias e
          Fatos Relevantes ficam de fora daqui (já têm aba própria) — aqui é fluxo, z-score,
          preço-alvo, watchlist e o painel de Oportunidades (quedas fortes, cripto capitulando na
          semana, FII sem próximo dividendo anunciado).
        </p>
      </div>

      {alerts.length === 0 ? (
        <Panel title="Alertas" updatedAt={now}>
          <p className="text-sm text-text-muted">Nenhum alerta disparado no período.</p>
        </Panel>
      ) : (
        CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
          <Panel key={cat} title={cat} updatedAt={now}>
            <AlertStatusList alerts={grouped.get(cat)!} />
          </Panel>
        ))
      )}
    </div>
  );
}
