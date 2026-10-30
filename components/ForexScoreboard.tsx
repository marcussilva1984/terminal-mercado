import { computeScoreboard, type TrackedIdea } from "@/lib/db/forexIdeaRepo";
import { formatFx } from "@/lib/forexIdeas";
import { MAX_DAYS_OPEN } from "@/lib/forexIdeaTracker";

const STATUS_LABEL: Record<TrackedIdea["status"], { text: string; className: string }> = {
  aberta: { text: "aberta", className: "text-text-muted" },
  alvo: { text: "✅ alvo", className: "text-up" },
  stop: { text: "❌ stop", className: "text-down" },
  expirada: { text: "⌛ expirou", className: "text-text-muted" },
};

function daysBetween(from: string, to: string | number): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}

function signedR(r: number): string {
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`;
}

function Stat({ label, value, className = "text-text" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded border border-border bg-panel-alt px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${className}`}>{value}</div>
    </div>
  );
}

export function ForexScoreboard({
  tracked,
  prices,
  now,
}: {
  tracked: TrackedIdea[];
  prices: Record<string, number>;
  now: number;
}) {
  const stats = computeScoreboard(tracked);
  const open = tracked.filter((t) => t.status === "aberta");
  const closed = tracked.filter((t) => t.status !== "aberta").slice(0, 10);

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-text">Placar das ideias fortes</h2>
      <p className="mb-3 text-xs text-text-muted">
        Todo dia às 21h30 UTC o sistema registra cada ideia forte (carry ou tendência) com entrada, stop e alvo, e
        acompanha pelos candles diários até bater um dos dois — ou expirar em {MAX_DAYS_OPEN} dias. Se stop e alvo
        caem no mesmo candle, conta stop (sem dado intraday não dá pra saber a ordem). É o teste de se a heurística
        funciona antes de arriscar dinheiro.
      </p>

      {tracked.length === 0 ? (
        <p className="text-sm text-text-muted">
          O placar começa na próxima rodada do cron — ainda não há ideias registradas.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Abertas" value={String(stats.open)} />
            <Stat label="Fechadas" value={`${stats.closed} (${stats.wins}✅ ${stats.losses}❌ ${stats.expired}⌛)`} />
            <Stat
              label="Acerto (alvo ÷ alvo+stop)"
              value={stats.hitRate === null ? "—" : `${stats.hitRate.toFixed(0)}%`}
              className={stats.hitRate === null ? "text-text-muted" : stats.hitRate >= 34 ? "text-up" : "text-down"}
            />
            <Stat
              label="R médio por ideia"
              value={stats.avgR === null ? "—" : signedR(stats.avgR)}
              className={stats.avgR === null ? "text-text-muted" : stats.avgR >= 0 ? "text-up" : "text-down"}
            />
            <Stat label="R total" value={signedR(stats.totalR)} className={stats.totalR >= 0 ? "text-up" : "text-down"} />
          </div>
          <p className="-mt-2 text-xs text-text-muted">
            Com R:R 2:1, acertar mais de 34% das vezes já deixa o resultado positivo.
          </p>

          {open.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="pb-2 font-medium">Par</th>
                    <th className="pb-2 font-medium">Lado</th>
                    <th className="pb-2 text-right font-medium">Dias</th>
                    <th className="pb-2 text-right font-medium">Entrada</th>
                    <th className="pb-2 text-right font-medium">Atual</th>
                    <th className="pb-2 text-right font-medium">Stop</th>
                    <th className="pb-2 text-right font-medium">Alvo</th>
                    <th className="pb-2 text-right font-medium">Agora</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((t) => {
                    const price = prices[t.pair];
                    const risk = Math.abs(t.entry - t.stop);
                    const rNow = price !== undefined ? ((price - t.entry) / risk) * (t.direction === "alta" ? 1 : -1) : null;
                    return (
                      <tr key={t.id} className="border-b border-border/40 tabular-nums last:border-0">
                        <td className="py-1.5 font-medium text-text">{t.pair}</td>
                        <td className="py-1.5 text-text-muted">{t.direction === "alta" ? "compra" : "venda"}</td>
                        <td className="py-1.5 text-right text-text-muted">{daysBetween(t.openedAt, now)}</td>
                        <td className="py-1.5 text-right text-text">{formatFx(t.pair, t.entry)}</td>
                        <td className="py-1.5 text-right text-text">{price !== undefined ? formatFx(t.pair, price) : "—"}</td>
                        <td className="py-1.5 text-right text-down">{formatFx(t.pair, t.stop)}</td>
                        <td className="py-1.5 text-right text-up">{formatFx(t.pair, t.target)}</td>
                        <td className={`py-1.5 text-right ${rNow === null ? "text-text-muted" : rNow >= 0 ? "text-up" : "text-down"}`}>
                          {rNow === null ? "—" : signedR(rNow)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {closed.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Últimas fechadas</p>
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="pb-2 font-medium">Par</th>
                    <th className="pb-2 font-medium">Lado</th>
                    <th className="pb-2 font-medium">Resultado</th>
                    <th className="pb-2 text-right font-medium">R</th>
                    <th className="pb-2 text-right font-medium">Dias</th>
                    <th className="pb-2 text-right font-medium">Fechou em</th>
                  </tr>
                </thead>
                <tbody>
                  {closed.map((t) => (
                    <tr key={t.id} className="border-b border-border/40 tabular-nums last:border-0">
                      <td className="py-1.5 font-medium text-text">{t.pair}</td>
                      <td className="py-1.5 text-text-muted">{t.direction === "alta" ? "compra" : "venda"}</td>
                      <td className={`py-1.5 ${STATUS_LABEL[t.status].className}`}>{STATUS_LABEL[t.status].text}</td>
                      <td className={`py-1.5 text-right ${(t.resultR ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                        {t.resultR === null ? "—" : signedR(t.resultR)}
                      </td>
                      <td className="py-1.5 text-right text-text-muted">{daysBetween(t.openedAt, t.closedAt ?? now)}</td>
                      <td className="py-1.5 text-right text-text-muted">
                        {t.closedAt ? new Date(t.closedAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
