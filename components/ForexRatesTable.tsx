import { rateAgeDays, STALE_RATE_DAYS, type PolicyRate } from "@/lib/forexRates";

const STATUS_STYLE: Record<PolicyRate["status"], string> = {
  confirmado: "text-up",
  estimado: "text-yellow-400",
  manual: "text-text-muted",
};

export function ForexRatesTable({ rates, hideTitle = false }: { rates: PolicyRate[]; hideTitle?: boolean }) {
  const stale = rates.filter((r) => rateAgeDays(r) > STALE_RATE_DAYS);

  return (
    <div>
      {!hideTitle && <h2 className="mb-1 text-sm font-semibold text-text">Juros dos bancos centrais (G8)</h2>}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {rates.map((r) => {
          const age = rateAgeDays(r);
          return (
            <div key={r.currency} title={r.source} className="rounded border border-border bg-panel-alt px-2 py-2 text-center">
              <div className="text-xs font-medium text-text-muted">{r.currency}</div>
              <div className="text-sm font-semibold tabular-nums text-text">{r.rate.toFixed(2)}%</div>
              <div className={`text-[10px] ${STATUS_STYLE[r.status]}`}>{r.status}</div>
              <div className={`text-[10px] ${age > STALE_RATE_DAYS ? "text-down" : "text-text-muted"}`}>
                {age === 0 ? "hoje" : `há ${age}d`}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Atualizadas sozinhas pelo calendário econômico: <span className="text-up">confirmado</span> = taxa vigente antes
        da próxima reunião; <span className="text-yellow-400">estimado</span> = consenso de reunião que já passou (o feed
        não traz o resultado oficial — confirma na reunião seguinte); manual = conferido em notícias. Passe o mouse pra ver
        a fonte.
      </p>
      {stale.length > 0 && (
        <p className="mt-1 text-xs text-down">
          ⚠ Sem confirmação há mais de {STALE_RATE_DAYS} dias: {stale.map((r) => r.currency).join(", ")} — o carry desses
          pares pode estar desatualizado.
        </p>
      )}
    </div>
  );
}
