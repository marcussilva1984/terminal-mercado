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
import { getBrapiRanking, type BrapiListItem } from "@/lib/sources/brapi";
import type { RankingItem } from "@/lib/types";

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

  const [flowResult, newsResult, zScoreResult, gainersResult, losersResult, volumeResult] =
    await Promise.allSettled([
      getFlowHistory(),
      getNews("b3", 10),
      getZScoreHighlights("b3"),
      getBrapiRanking("change", "desc", 20),
      getBrapiRanking("change", "asc", 20),
      getBrapiRanking("volume", "desc", 20),
    ]);

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const zScoreHighlights = zScoreResult.status === "fulfilled" ? zScoreResult.value : null;
  const gainers = gainersResult.status === "fulfilled" ? gainersResult.value.map(toRankingItem) : null;
  const losers = losersResult.status === "fulfilled" ? losersResult.value.map(toRankingItem) : null;
  const byVolume = volumeResult.status === "fulfilled" ? volumeResult.value.map(toRankingItem) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ações (B3)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Rankings via brapi.dev, filtrados por liquidez mínima (volume ≥ 300 mil) para evitar
          frações e papéis sem negociação relevante.
        </p>
      </div>

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
          <RankingPanel title="Maiores Altas" items={gainers} updatedAt={now} valueLabel="Preço (R$)" format="price-brl" />
        ) : (
          <Panel title="Maiores Altas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {losers ? (
          <RankingPanel title="Maiores Baixas" items={losers} updatedAt={now} valueLabel="Preço (R$)" format="price-brl" />
        ) : (
          <Panel title="Maiores Baixas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {byVolume ? (
          <RankingPanel title="Maiores Volumes" items={byVolume} updatedAt={now} valueLabel="Preço (R$)" format="price-brl" />
        ) : (
          <Panel title="Maiores Volumes" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        <Panel title="Mais Alugadas (proxy de pressão vendedora)" updatedAt={now}>
          <p className="text-sm text-text-muted">
            Indisponível — o TradersClub bloqueia requisições automatizadas (proteção Cloudflare).
            Consulte manualmente em{" "}
            <a href="https://tc.tradersclub.com.br/mais-alugadas-b3" className="text-gold-bright hover:underline">
              tc.tradersclub.com.br/mais-alugadas-b3
            </a>
            .
          </p>
        </Panel>
      </div>

      <Panel title="Notícias Brasil / B3" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
