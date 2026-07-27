import { Panel } from "@/components/Panel";
import { RankingPanel } from "@/components/RankingPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { FlowSemaphore } from "@/components/FlowSemaphore";
import { FlowBarChart } from "@/components/FlowBarChart";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments, getFlowChartData, SEGMENT_CONFIG } from "@/lib/semaphore";
import { getNews } from "@/lib/sources/rss";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getB3VolatilityRanking } from "@/lib/volatilityService";
import { getBrapiRanking, type BrapiListItem } from "@/lib/sources/brapi";
import { buildB3Insights } from "@/lib/insights";
import { VolatilityTable } from "@/components/VolatilityTable";
import type { RankingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function toRankingItem(item: BrapiListItem): RankingItem {
  return {
    symbol: item.symbol,
    label: item.name,
    value: item.close,
    changePct: item.changePct,
    volume: item.volume,
  };
}

export default async function AcoesPage() {
  const now = new Date().toISOString();

  const [flowResult, newsResult, zScoreResult, gainersResult, losersResult, volumeResult, volatilityResult] =
    await Promise.allSettled([
      getFlowHistory(),
      getNews("b3", 10),
      getZScoreHighlights("b3"),
      getBrapiRanking("change", "desc", 20),
      getBrapiRanking("change", "asc", 20),
      getBrapiRanking("volume", "desc", 20),
      getB3VolatilityRanking(),
    ]);

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const zScoreHighlights = zScoreResult.status === "fulfilled" ? zScoreResult.value : null;
  const gainers = gainersResult.status === "fulfilled" ? gainersResult.value.map(toRankingItem) : null;
  const losers = losersResult.status === "fulfilled" ? losersResult.value.map(toRankingItem) : null;
  const byVolume = volumeResult.status === "fulfilled" ? volumeResult.value.map(toRankingItem) : null;
  const volatility = volatilityResult.status === "fulfilled" ? volatilityResult.value : null;

  const insights =
    gainers && losers && byVolume && flowResult.status === "fulfilled"
      ? buildB3Insights(gainers, losers, byVolume, buildFlowSegments(flowResult.value), zScoreHighlights ?? [])
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ações (B3)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Rankings via brapi.dev, filtrados por liquidez mínima (volume ≥ 300 mil) para evitar
          frações e papéis sem negociação relevante.
        </p>
      </div>

      {insights.length > 0 && (
        <Panel title="Insights do Dia" updatedAt={now}>
          <ul className="flex flex-col gap-2 text-sm text-text">
            {insights.map((insight, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-bright">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-muted">
            Gerado a partir dos rankings, fluxo agregado e z-score — não atribui fluxo de
            investidor a um ticker específico (isso só existe no B3 DataWise+, pago).
          </p>
        </Panel>
      )}

      <Panel title="Fluxo de Investidores — Semáforo" updatedAt={now}>
        {flowResult.status === "fulfilled" ? (
          <FlowSemaphore segments={buildFlowSegments(flowResult.value)} />
        ) : (
          <p className="text-sm text-down">
            Fonte indisponível no momento
            {flowResult.status === "rejected" && flowResult.reason instanceof Error
              ? `: ${flowResult.reason.message}`
              : "."}
          </p>
        )}
      </Panel>

      <Panel title="Fluxo Diário — Infográfico" updatedAt={now}>
        {flowResult.status === "fulfilled" ? (
          <FlowBarChart
            segments={SEGMENT_CONFIG.map((s) => getFlowChartData(flowResult.value, s.key, 20))}
          />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="Z-Score — Watchlist B3" updatedAt={now}>
        {zScoreHighlights ? (
          <ZScoreHighlightList items={zScoreHighlights} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gainers ? (
          <RankingPanel title="Maiores Altas" items={gainers} updatedAt={now} valueLabel="Preço (R$)" format="price-brl" assetClass="b3" />
        ) : (
          <Panel title="Maiores Altas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {losers ? (
          <RankingPanel title="Maiores Baixas" items={losers} updatedAt={now} valueLabel="Preço (R$)" format="price-brl" assetClass="b3" />
        ) : (
          <Panel title="Maiores Baixas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {byVolume ? (
          <RankingPanel title="Maiores Volumes" items={byVolume} updatedAt={now} valueLabel="Preço (R$)" format="price-brl" assetClass="b3" />
        ) : (
          <Panel title="Maiores Volumes" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        <Panel title="Volatilidade — proxy de risco (não é short interest)" updatedAt={now}>
          {volatility ? (
            <VolatilityTable items={volatility} />
          ) : (
            <p className="text-sm text-down">
              Fonte indisponível{volatilityResult.status === "rejected" && volatilityResult.reason instanceof Error
                ? `: ${volatilityResult.reason.message}`
                : "."}
            </p>
          )}
        </Panel>
      </div>
      <p className="text-xs text-text-muted">
        Sobre &quot;mais alugadas/alavancadas&quot;: não existe fonte gratuita real para B3 (o
        TradersClub bloqueia acesso automatizado via Cloudflare, e dívida/patrimônio exige dados
        fundamentalistas trimestrais que nenhuma API grátis expõe). Usamos volatilidade calculada
        como proxy de risco no lugar, deixado explícito acima. Para o dado oficial de posições
        alugadas, consulte diretamente em{" "}
        <a
          href="https://tc.tradersclub.com.br/mais-alugadas-b3"
          target="_blank"
          rel="noreferrer"
          className="text-gold-bright hover:underline"
        >
          tc.tradersclub.com.br/mais-alugadas-b3
        </a>
        .
      </p>

      <Panel title="Notícias Brasil / B3" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
