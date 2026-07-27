import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { changeColorClass, formatPct, formatPrice } from "@/lib/format";
import { getYahooQuotes, getYahooScreener, type YahooScreenerItem } from "@/lib/sources/yahoo";
import { getAnalystTargets } from "@/lib/sources/yahooAnalyst";
import { getNews } from "@/lib/sources/rss";
import { STOCKS_WATCHLIST, US_INDICES } from "@/lib/watchlist";
import { AnalystTargetTable, type AnalystTargetRow } from "@/components/AnalystTargetTable";
import type { RankingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function toRankingItem(item: YahooScreenerItem): RankingItem {
  return { symbol: item.symbol, label: item.name, value: item.price, changePct: item.changePct, volume: item.volume };
}

export default async function StocksPage() {
  const now = new Date().toISOString();

  const [indices, watchlistQuotes, gainersResult, losersResult, activesResult, news, analystTargets] = await Promise.all([
    getYahooQuotes(US_INDICES.map((i) => i.symbol)),
    getYahooQuotes(STOCKS_WATCHLIST.map((w) => w.symbol)),
    getYahooScreener("day_gainers", 20).catch(() => null),
    getYahooScreener("day_losers", 20).catch(() => null),
    getYahooScreener("most_actives", 20).catch(() => null),
    getNews("internacional", 10),
    getAnalystTargets(STOCKS_WATCHLIST.map((w) => w.symbol)).catch(() => []),
  ]);

  const gainers = gainersResult?.map(toRankingItem) ?? null;
  const losers = losersResult?.map(toRankingItem) ?? null;
  const actives = activesResult?.map(toRankingItem) ?? null;

  const analystRows: AnalystTargetRow[] = analystTargets
    .map((a) => {
      const quote = watchlistQuotes[a.symbol];
      const label = STOCKS_WATCHLIST.find((w) => w.symbol === a.symbol)?.label ?? a.symbol;
      const price = a.currentPrice ?? quote?.price;
      if (!price || a.targetMeanPrice === null) return null;
      return {
        symbol: a.symbol,
        label,
        currentPrice: price,
        targetMeanPrice: a.targetMeanPrice,
        targetHighPrice: a.targetHighPrice,
        targetLowPrice: a.targetLowPrice,
        upsidePct: ((a.targetMeanPrice - price) / price) * 100,
        recommendationMean: a.recommendationMean,
        numberOfAnalysts: a.numberOfAnalysts,
      };
    })
    .filter((r): r is AnalystTargetRow => r !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Stocks (EUA)</h1>
        <p className="mt-1 text-sm text-text-muted">Dados reais via Yahoo Finance (sem chave de API).</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {US_INDICES.map((idx) => {
          const q = indices[idx.symbol];
          return q ? (
            <StatCard key={idx.symbol} label={idx.label} value={formatPrice(q.price, q.currency)} changePct={q.changePct} />
          ) : null;
        })}
      </div>

      <Panel title="Watchlist" updatedAt={now}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {STOCKS_WATCHLIST.map((w) => {
            const q = watchlistQuotes[w.symbol];
            return (
              <div key={w.symbol} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-sm font-medium text-text">{w.symbol}</div>
                  <div className="text-xs text-text-muted">{w.label}</div>
                </div>
                {q ? (
                  <div className="text-right">
                    <div className="text-sm text-text">{formatPrice(q.price, q.currency)}</div>
                    <div className={`text-xs ${changeColorClass(q.changePct)}`}>{formatPct(q.changePct)}</div>
                  </div>
                ) : (
                  <span className="text-xs text-down">indisponível</span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Preço-Alvo dos Analistas" updatedAt={now}>
        <AnalystTargetTable items={analystRows} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gainers ? (
          <RankingPanel title="Maiores Altas" items={gainers} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" />
        ) : (
          <Panel title="Maiores Altas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {losers ? (
          <RankingPanel title="Maiores Baixas" items={losers} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" />
        ) : (
          <Panel title="Maiores Baixas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {actives ? (
          <RankingPanel title="Maiores Volumes" items={actives} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" />
        ) : (
          <Panel title="Maiores Volumes" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        <Panel title="Notícias EUA" updatedAt={now}>
          <NewsFeed items={news} now={now} />
        </Panel>
      </div>
    </div>
  );
}
