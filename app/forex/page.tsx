import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { NewsFeed } from "@/components/NewsFeed";
import { CurrencyStrengthMeter } from "@/components/CurrencyStrengthMeter";
import { EconomicCalendar } from "@/components/EconomicCalendar";
import { changeColorClass, formatNumber, formatPct } from "@/lib/format";
import { getForexPairs, getCurrencyStrength, getDXY, getUSYieldCurve } from "@/lib/forexService";
import { getWeeklyCalendar, filterHighSignal, filterRateDecisions } from "@/lib/sources/economicCalendar";
import { getNews } from "@/lib/sources/rss";

export const dynamic = "force-dynamic";

export default async function ForexPage() {
  const now = new Date().toISOString();

  const [pairsResult, strengthResult, dxyResult, yieldsResult, calendarResult, news] = await Promise.all([
    getForexPairs().catch(() => null),
    getCurrencyStrength().catch(() => null),
    getDXY().catch(() => null),
    getUSYieldCurve().catch(() => null),
    getWeeklyCalendar().catch(() => null),
    getNews("forex", 10),
  ]);

  const rateDecisions = calendarResult ? filterRateDecisions(calendarResult) : null;
  const highSignalEvents = calendarResult ? filterHighSignal(calendarResult) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Forex</h1>
        <p className="mt-1 text-sm text-text-muted">Dados reais via Yahoo Finance (sem chave de API).</p>
      </div>

      {dxyResult && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Índice Dólar (DXY)" value={dxyResult.price.toFixed(2)} changePct={dxyResult.changePct} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Pares Principais (G8 + BRL)" updatedAt={now}>
          {pairsResult ? (
            <div className="flex flex-col divide-y divide-border/50">
              {pairsResult.map((p) => (
                <div key={p.pair} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-text">{p.pair}</div>
                    <div className="text-xs text-text-muted">{p.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-text">{formatNumber(p.price, p.price < 10 ? 4 : 2)}</div>
                    <div className={`text-xs ${changeColorClass(p.changePct)}`}>{formatPct(p.changePct)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Cache reduzido a 30s (Yahoo Finance, sem chave). Cotação de forex tem um delay natural
            pequeno da própria fonte gratuita — não existe API 100% real-time sem custo.
          </p>
        </Panel>

        <Panel title="Força das Moedas (G8)" updatedAt={now}>
          {strengthResult ? (
            <>
              <CurrencyStrengthMeter items={strengthResult} />
              <p className="mt-3 text-xs text-text-muted">
                Variação média de cada moeda contra a cesta das outras 7, no dia. Aproximação via
                pares vs. USD — não são 28 cruzamentos reais.
              </p>
            </>
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>
      </div>

      <Panel title="Curva de Juros (EUA)" updatedAt={now}>
        {yieldsResult ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {yieldsResult.map((y) => (
              <StatCard key={y.label} label={y.label} value={`${formatNumber(y.yieldPct)}%`} changePct={y.changePct} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Curva de juros do Brasil (DI) fica para uma fase futura — a fonte pública exige scraping
          mais trabalhoso (contratos futuros na B3).
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Bancos Centrais — decisões e falas (semana)" updatedAt={now}>
          {rateDecisions ? (
            <EconomicCalendar events={rateDecisions} />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>

        <Panel title="Calendário Econômico — fique de olho" updatedAt={now}>
          {highSignalEvents ? (
            <EconomicCalendar events={highSignalEvents} />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Só impacto alto/médio (juros, inflação, emprego, PIB) — sem o ruído de dado
            irrelevante. Fonte: mesmo feed público usado pelo calendário do ForexFactory.
          </p>
        </Panel>
      </div>

      <Panel title="Notícias Forex / Macro" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
