import { Panel } from "@/components/Panel";
import { NewsFeed } from "@/components/NewsFeed";
import { StatCard } from "@/components/StatCard";
import { EconomicCalendar } from "@/components/EconomicCalendar";
import { getNews } from "@/lib/sources/rss";
import { getUSYieldCurve } from "@/lib/forexService";
import { formatNumber } from "@/lib/format";
import { getPolicyRates } from "@/lib/forexRates";
import { ForexRatesTable } from "@/components/ForexRatesTable";
import {
  getWeeklyCalendar,
  filterHighSignal,
  filterRateDecisions,
  filterUpcoming,
} from "@/lib/sources/economicCalendar";

export const revalidate = 300;

export default async function MacroPage() {
  const now = new Date().toISOString();

  const [yieldsResult, calendarResult, macroNews, policyRates] = await Promise.all([
    getUSYieldCurve().catch(() => null),
    getWeeklyCalendar().catch(() => null),
    getNews("macro", 40),
    getPolicyRates(),
  ]);

  const rateDecisions = calendarResult
    ? filterUpcoming(filterRateDecisions(calendarResult))
    : null;

  const highSignal = calendarResult
    ? filterUpcoming(filterHighSignal(calendarResult))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Macro</h1>
        <p className="mt-1 text-sm text-text-muted">
          Comunicados de bancos centrais, calendário econômico de alto impacto e curva de juros — tudo que move mercados globais.
        </p>
      </div>

      {/* Curva de juros EUA */}
      {yieldsResult && (
        <Panel title="Curva de juros — EUA" updatedAt={now}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {yieldsResult.map((y) => (
              <StatCard
                key={y.label}
                label={y.label}
                value={`${formatNumber(y.yieldPct)}%`}
                changePct={y.changePct}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Spread 10y–2y positivo = curva normal. Invertida (spread negativo) = sinal histórico de recessão em 6–18 meses.
          </p>
        </Panel>
      )}

      <Panel title="Juros dos bancos centrais (G8)" updatedAt={now}>
        <ForexRatesTable rates={policyRates} hideTitle />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Decisões de taxa iminentes */}
        <Panel title="Decisões de taxa — esta semana" updatedAt={now}>
          {rateDecisions && rateDecisions.length > 0 ? (
            <EconomicCalendar events={rateDecisions} />
          ) : (
            <p className="text-sm text-text-muted">Nenhuma decisão de taxa esta semana.</p>
          )}
        </Panel>

        {/* Eventos de alto impacto */}
        <Panel title="Calendário — alto impacto (semana)" updatedAt={now}>
          {highSignal && highSignal.length > 0 ? (
            <EconomicCalendar events={highSignal} />
          ) : (
            <p className="text-sm text-text-muted">Nenhum evento de alto impacto esta semana.</p>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Só impacto alto das principais economias (USD, EUR, JPY, GBP, CHF, CAD, AUD, NZD). Eventos passados somem da lista.
          </p>
        </Panel>
      </div>

      {/* Feed de comunicados */}
      <Panel title="Comunicados de bancos centrais &amp; análise macro" updatedAt={now}>
        <NewsFeed items={macroNews} now={now} />
        <p className="mt-3 text-xs text-text-muted">
          Fed, ECB, BoE, BoJ, BIS e FMI — comunicados oficiais + análise macro do ING Think.
        </p>
      </Panel>
    </div>
  );
}
