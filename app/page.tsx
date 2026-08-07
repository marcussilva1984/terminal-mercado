import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { FlowSemaphore } from "@/components/FlowSemaphore";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { EconomicCalendar } from "@/components/EconomicCalendar";
import { CopyResumoButton } from "@/components/CopyResumoButton";
import { Headline } from "@/components/Headline";
import { DailyHighlightsList } from "@/components/DailyHighlightsList";
import { getNews } from "@/lib/sources/rss";
import { isExtremeNews } from "@/lib/sentiment";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments } from "@/lib/semaphore";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getRealHighlightCards } from "@/lib/tickerService";
import { getWeeklyCalendar, filterHighSignal, filterUpcoming } from "@/lib/sources/economicCalendar";
import { buildDailyHighlights } from "@/lib/dailyHighlights";

// Pouco tráfego = ISR fica "presa" em cache velho até alguém disparar a
// revalidação em segundo plano. Renderizar sempre fresco garante que o F5
// do usuário sempre reflita o estado atual das fontes (cada uma com seu
// próprio cache curto, então não sobrecarrega as APIs externas).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [news, flowResult, zScoreHighlights, highlightCards, calendarResult] = await Promise.all([
    getNews(undefined, 15),
    getFlowHistory().catch(() => null),
    getZScoreHighlights().catch(() => null),
    getRealHighlightCards().catch(() => []),
    getWeeklyCalendar().catch(() => null),
  ]);

  const radarEvents = calendarResult ? filterUpcoming(filterHighSignal(calendarResult)).slice(0, 20) : null;
  const now = new Date().toISOString();
  const headline = news.find((n) => isExtremeNews(n.title)) ?? null;

  const todayISO = now.slice(0, 10);
  const calendarToday = calendarResult ? filterHighSignal(calendarResult).filter((e) => e.date.slice(0, 10) === todayISO) : [];
  const flowSegments = flowResult ? buildFlowSegments(flowResult) : null;
  const dailyHighlights = buildDailyHighlights(calendarToday, flowSegments, zScoreHighlights);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Resumo do Dia</h1>
          <p className="mt-1 text-sm text-text-muted">
            Fluxo B3 e z-score já usam dados reais (precisam de <code>DATABASE_URL</code> configurada).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyResumoButton />
          <a
            href="/relatorio"
            className="rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
          >
            Relatório PDF
          </a>
        </div>
      </div>

      {headline && <Headline item={headline} />}

      {highlightCards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {highlightCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} changePct={card.changePct} />
          ))}
        </div>
      )}

      {dailyHighlights.length > 0 && (
        <Panel title="Destaques do Dia" updatedAt={now}>
          <DailyHighlightsList items={dailyHighlights} />
          <p className="mt-3 text-xs text-text-muted">
            Gerado só a partir de dados já coletados (calendário econômico, fluxo B3, z-score da
            watchlist) — não interpreta conteúdo de notícia, pra não arriscar inventar detalhe.
          </p>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Semáforo de Fluxo B3" updatedAt={now}>
          {flowResult ? (
            <FlowSemaphore segments={buildFlowSegments(flowResult)} compact />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>

        <Panel title="Destaques de Z-Score" updatedAt={now}>
          {zScoreHighlights ? (
            <ZScoreHighlightList items={zScoreHighlights} />
          ) : (
            <p className="text-sm text-text-muted">
              Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
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
          forex e cripto ao mesmo tempo — só o que ainda vai acontecer (já passou, some da lista).
          Detalhe completo na aba Forex.
        </p>
      </Panel>
    </div>
  );
}
