import type { AlertStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const KIND_LABEL: Record<AlertStatus["kind"], string> = {
  fluxo: "Fluxo",
  watchlist: "Watchlist",
  zscore: "Z-score",
  preco: "Preço",
};

export function AlertStatusList({ alerts }: { alerts: AlertStatus[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum alerta disparado nas últimas 24h.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {alerts.map((alert, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span className="rounded border border-gold/40 px-1.5 py-0.5 text-xs text-gold-bright">
              {KIND_LABEL[alert.kind]}
            </span>
            <span className="text-sm text-text">{alert.label}</span>
          </div>
          <span className="shrink-0 text-xs text-text-muted">{formatDateTime(alert.triggeredAt)}</span>
        </li>
      ))}
    </ul>
  );
}
