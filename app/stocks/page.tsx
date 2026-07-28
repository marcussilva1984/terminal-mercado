import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { changeColorClass, formatPct, formatPrice } from "@/lib/format";
import { getYahooQuotes, getYahooScreener, type YahooScreenerItem } from "@/lib/sources/yahoo";
import { getNews } from "@/lib/sources/rss";
import { STOCKS_WATCHLIST, US_INDICES } from "@/lib/watchlist";
import { buildGenericInsights, fillMinimumInsights } from "@/lib/insights";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import type { RankingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function toRankingItem(item: YahooScreenerItem): RankingItem {
  return { symbol: item.symbol, label: item.name, value: item.price, changePct: item.changePct, volume: item.volume };
}

export default async function StocksPage() {
  const now = new Date().toISOString();

  const [indices, watchlistQuotes, gainersResult, losersResult, activesResult, news, zScoreResult] = await Promise.all([
    getYahooQuotes(US_INDICES.map((i) => i.symbol)),
    getYahooQuotes(STOCKS_WATCHLIST.map((w) => w.symbol)),
    getYahooScreener("day_gainers", 20).catch(() => null),
    getYahooScreener("day_losers", 20).catch(() => null),
    getYahooScreener("most_actives", 20).catch(() => null),
    getNews("internacional", 10),
    getZScoreHighlights("stocks").catch(() => null),
  ]);

  const gainers = gainersResult?.map(toRankingItem) ?? null;
  const losers = losersResult?.map(toRankingItem) ?? null;
  const actives = activesResult?.map(toRankingItem) ?? null;

  const insights: string[] =
    gainers && losers && actives ? buildGenericInsights(gainers, losers, actives) : [];

  // Índices em alta/baixa forte (>1%) — sinal de dia direcional pro mercado como um todo.
  for (const idx of US_INDICES) {
    const q = indices[idx.symbol];
    if (q && Math.abs(q.changePct) >= 1) {
      insights.push(`${idx.label} ${q.changePct >= 0 ? "sobe" : "cai"} ${formatPct(Math.abs(q.changePct)).replace("+", "")} — movimento direcional no mercado americano.`);
    }
  }

  // Destaques da watchlist com movimento forte (>3%).
  for (const w of STOCKS_WATCHLIST) {
    const q = watchlistQuotes[w.symbol];
    if (q && Math.abs(q.changePct) >= 3) {
      insights.push(`${w.symbol} (watchlist) ${q.changePct >= 0 ? "dispara" : "despenca"} ${formatPct(Math.abs(q.changePct)).replace("+", "")} hoje.`);
    }
  }

  // Ações que aparecem simultaneamente em altas E maiores volumes (convicção),
  // e o mesmo pro lado das baixas.
  if (gainers && actives) {
    const activeSymbols = new Set(actives.slice(0, 15).map((a) => a.symbol));
    const convictionGainers = gainers.filter((g) => activeSymbols.has(g.symbol)).slice(0, 3);
    for (const g of convictionGainers) {
      insights.push(`${g.symbol} sobe com volume elevado (${formatPct(g.changePct)}) — não é só ruído de baixa liquidez.`);
    }
  }
  if (losers && actives) {
    const activeSymbols = new Set(actives.slice(0, 15).map((a) => a.symbol));
    const convictionLosers = losers.filter((l) => activeSymbols.has(l.symbol)).slice(0, 3);
    for (const l of convictionLosers) {
      insights.push(`${l.symbol} cai com volume elevado (${formatPct(l.changePct)}) — pressão vendedora real, não ruído.`);
    }
  }

  const finalInsights = gainers && losers ? fillMinimumInsights(insights, [...gainers, ...losers]) : insights;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Stocks (EUA)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Dados reais via Yahoo Finance (sem chave de API). Preço-alvo dos analistas e insiders ficaram
          concentrados na aba Fundamentalista, por ativo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {US_INDICES.map((idx) => {
          const q = indices[idx.symbol];
          return q ? (
            <StatCard key={idx.symbol} label={idx.label} value={formatPrice(q.price, q.currency)} changePct={q.changePct} />
          ) : null;
        })}
      </div>

      {finalInsights.length > 0 && (
        <Panel title="Insights do Dia" updatedAt={now}>
          <ul className="flex flex-col gap-2 text-sm text-text">
            {finalInsights.slice(0, 15).map((insight, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-bright">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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

      <Panel title="Z-Score — Watchlist Stocks" updatedAt={now}>
        {zScoreResult ? (
          <ZScoreHighlightList items={zScoreResult} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gainers ? (
          <RankingPanel title="Maiores Altas" items={gainers} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" assetClass="stocks" />
        ) : (
          <Panel title="Maiores Altas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {losers ? (
          <RankingPanel title="Maiores Baixas" items={losers} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" assetClass="stocks" />
        ) : (
          <Panel title="Maiores Baixas" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {actives ? (
          <RankingPanel title="Maiores Volumes" items={actives} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" assetClass="stocks" />
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
