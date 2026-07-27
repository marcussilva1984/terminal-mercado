import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { RankingTable } from "@/components/RankingTable";
import { NewsFeed } from "@/components/NewsFeed";
import { FlowSemaphore } from "@/components/FlowSemaphore";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { AlertStatusList } from "@/components/AlertStatusList";
import { EconomicCalendar } from "@/components/EconomicCalendar";
import { CopyResumoButton } from "@/components/CopyResumoButton";
import { changeColorClass, formatPct, formatPrice } from "@/lib/format";
import { getNews } from "@/lib/sources/rss";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments } from "@/lib/semaphore";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getRealHighlightCards, getRealTickerQuotes } from "@/lib/tickerService";
import { getBrapiRanking } from "@/lib/sources/brapi";
import { getWeeklyCalendar, filterHighSignal } from "@/lib/sources/economicCalendar";
import { getRecentAlerts } from "@/lib/db/alertRepo";
import type { RankingItem } from "@/lib/types";

// Pouco tráfego = ISR fica "presa" em cache velho até alguém disparar a
// revalidação em segundo plano. Renderizar sempre fresco garante que o F5
// do usuário sempre reflita o estado atual das fontes (cada uma com seu
// próprio cache curto, então não sobrecarrega as APIs externas).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [news, flowResult, zScoreHighlights, highlightCards, quotes, gainersResult, losersResult, calendarResult, alerts] =
    await Promise.all([
      getNews(undefined, 5),
      getFlowHistory().catch(() => null),
      getZScoreHighlights().catch(() => null),
      getRealHighlightCards().catch(() => []),
      getRealTickerQuotes().catch(() => []),
      getBrapiRanking("change", "desc", 3).catch(() => null),
      getBrapiRanking("change", "asc", 3).catch(() => null),
      getWeeklyCalendar().catch(() => null),
      getRecentAlerts(24).catch(() => null),
    ]);

  const radarEvents = calendarResult ? filterHighSignal(calendarResult).slice(0, 5) : null;
  const now = new Date().toISOString();

  const toRankingItem = (item: NonNullable<typeof gainersResult>[number]): RankingItem => ({
    symbol: item.symbol,
    label: item.name,
    value: item.close,
    changePct: item.changePct,
    volume: item.volume,
  });
  const altas = gainersResult?.map(toRankingItem) ?? null;
  const baixas = losersResult?.map(toRankingItem) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Resumo do Dia</h1>
          <p className="mt-1 text-sm text-text-muted">
            Notícias, preços, fluxo B3, rankings, z-score e alertas já usam dados reais (precisam de{" "}
            <code>DATABASE_URL</code> configurada; alertas via Telegram também precisam do bot).
          </p>
        </div>
        <CopyResumoButton />
      </div>

      {highlightCards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {highlightCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} changePct={card.changePct} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Semáforo de Fluxo B3" updatedAt={now}>
          {flowResult ? (
            <FlowSemaphore segments={buildFlowSegments(flowResult)} compact />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>

        <Panel title="Preços" updatedAt={now}>
          {quotes.length > 0 ? (
            <div className="flex flex-col divide-y divide-border/50">
              {quotes.map((q) => (
                <div key={q.symbol} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-text">{q.symbol}</div>
                    <div className="text-xs text-text-muted">{q.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-text">{formatPrice(q.price, q.currency)}</div>
                    <div className={`text-xs ${changeColorClass(q.changePct)}`}>{formatPct(q.changePct)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>

        <Panel title="Destaques de Z-Score" updatedAt={now}>
          {zScoreHighlights ? (
            <ZScoreHighlightList items={zScoreHighlights.slice(0, 5)} />
          ) : (
            <p className="text-sm text-text-muted">
              Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Top 3 Altas — B3" updatedAt={now}>
          {altas ? <RankingTable items={altas} valueLabel="Preço (R$)" /> : <p className="text-sm text-down">Fonte indisponível no momento.</p>}
        </Panel>
        <Panel title="Top 3 Baixas — B3" updatedAt={now}>
          {baixas ? <RankingTable items={baixas} valueLabel="Preço (R$)" /> : <p className="text-sm text-down">Fonte indisponível no momento.</p>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Notícias Recentes" updatedAt={now}>
            <NewsFeed items={news} now={now} />
          </Panel>
        </div>
        <Panel title="Alertas (últimas 24h)" updatedAt={now}>
          {alerts ? (
            <AlertStatusList alerts={alerts} />
          ) : (
            <p className="text-sm text-text-muted">
              Configure <code>DATABASE_URL</code> e o bot do Telegram para habilitar os alertas.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Radar da Semana — fique de olho" updatedAt={now}>
        {radarEvents ? (
          <EconomicCalendar events={radarEvents} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Eventos de alto/médio impacto (juros, inflação, emprego) que costumam mexer com ações,
          forex e cripto ao mesmo tempo. Detalhe completo na aba Forex.
        </p>
      </Panel>
    </div>
  );
}
