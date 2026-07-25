import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { Panel } from "@/components/Panel";
import { NewsFeed } from "@/components/NewsFeed";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { getTopCoinMarkets, type CoinMarket } from "@/lib/sources/coingecko";
import { getNews } from "@/lib/sources/rss";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { formatPrice } from "@/lib/format";
import type { RankingItem } from "@/lib/types";

function toRankingItem(coin: CoinMarket, metric: "price" | "volume" | "marketcap"): RankingItem {
  const valueByMetric = {
    price: coin.current_price,
    volume: coin.total_volume,
    marketcap: coin.market_cap,
  };
  return {
    symbol: coin.symbol.toUpperCase(),
    label: coin.name,
    value: valueByMetric[metric],
    changePct: coin.price_change_percentage_24h ?? 0,
  };
}

export default async function CriptoPage() {
  let coins: CoinMarket[] = [];
  let available = true;
  let fetchError: string | undefined;

  const [coinsResult, newsResult, zScoreResult] = await Promise.allSettled([
    getTopCoinMarkets(100),
    getNews("cripto", 10),
    getZScoreHighlights("cripto"),
  ]);

  if (coinsResult.status === "fulfilled") {
    coins = coinsResult.value;
  } else {
    available = false;
    fetchError = coinsResult.reason instanceof Error ? coinsResult.reason.message : "Falha desconhecida";
  }

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const zScoreHighlights = zScoreResult.status === "fulfilled" ? zScoreResult.value : null;

  const now = new Date().toISOString();

  if (!available) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-text">Cripto</h1>
        <Panel title="CoinGecko" updatedAt={now}>
          <p className="text-sm text-down">
            Fonte indisponível no momento{fetchError ? `: ${fetchError}` : "."} As demais seções do
            dashboard continuam funcionando normalmente.
          </p>
        </Panel>
        <Panel title="Z-Score Cripto" updatedAt={now}>
          {zScoreHighlights ? (
            <ZScoreHighlightList items={zScoreHighlights} />
          ) : (
            <p className="text-sm text-text-muted">
              Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
            </p>
          )}
        </Panel>
        <Panel title="Notícias Cripto" updatedAt={now}>
          <NewsFeed items={news} now={now} />
        </Panel>
      </div>
    );
  }

  const btc = coins.find((c) => c.symbol.toLowerCase() === "btc");
  const eth = coins.find((c) => c.symbol.toLowerCase() === "eth");

  const gainers = [...coins]
    .filter((c) => c.price_change_percentage_24h !== null)
    .sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0))
    .map((c) => toRankingItem(c, "price"));

  const losers = [...coins]
    .filter((c) => c.price_change_percentage_24h !== null)
    .sort((a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0))
    .map((c) => toRankingItem(c, "price"));

  const byVolume = [...coins]
    .sort((a, b) => b.total_volume - a.total_volume)
    .map((c) => toRankingItem(c, "volume"));

  const byMarketCap = [...coins]
    .sort((a, b) => b.market_cap - a.market_cap)
    .map((c) => toRankingItem(c, "marketcap"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Cripto</h1>
        <p className="mt-1 text-sm text-text-muted">Dados reais via CoinGecko (delay curto, sem chave de API).</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {btc && (
          <StatCard label="Bitcoin (BTC)" value={formatPrice(btc.current_price, "USD")} changePct={btc.price_change_percentage_24h ?? 0} />
        )}
        {eth && (
          <StatCard label="Ethereum (ETH)" value={formatPrice(eth.current_price, "USD")} changePct={eth.price_change_percentage_24h ?? 0} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingPanel
          title="Maiores Altas 24h"
          items={gainers}
          updatedAt={now}
          valueLabel="Preço (US$)"
          format="price-usd"
        />
        <RankingPanel
          title="Maiores Baixas 24h"
          items={losers}
          updatedAt={now}
          valueLabel="Preço (US$)"
          format="price-usd"
        />
        <RankingPanel
          title="Maiores Volumes 24h"
          items={byVolume}
          updatedAt={now}
          valueLabel="Volume 24h"
          format="compact-usd"
        />
        <RankingPanel
          title="Top Market Cap"
          items={byMarketCap}
          updatedAt={now}
          valueLabel="Market Cap"
          format="compact-usd"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Z-Score Cripto" updatedAt={now}>
          {zScoreHighlights ? (
            <ZScoreHighlightList items={zScoreHighlights} />
          ) : (
            <p className="text-sm text-text-muted">
              Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
            </p>
          )}
        </Panel>
        <Panel title="Notícias Cripto" updatedAt={now}>
          <NewsFeed items={news} now={now} />
        </Panel>
      </div>
    </div>
  );
}
