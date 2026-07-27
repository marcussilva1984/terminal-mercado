import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { Panel } from "@/components/Panel";
import { NewsFeed } from "@/components/NewsFeed";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { getTopCoinMarkets, getCoinCategories, type CoinMarket } from "@/lib/sources/coingecko";
import type { DerivativeSnapshot } from "@/lib/sources/binanceFutures";
import { getOnChainSnapshot, getFearGreedIndex } from "@/lib/sources/onchain";
import { getBaseUrl } from "@/lib/baseUrl";
import { getNews } from "@/lib/sources/rss";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { formatPrice } from "@/lib/format";
import { LongShortPanel, FundingRateTable, OpenInterestPanel } from "@/components/DerivativesPanel";
import { OnChainPanel } from "@/components/OnChainPanel";
import type { RankingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const fetchDerivatives = async (): Promise<DerivativeSnapshot[]> => {
    const res = await fetch(`${getBaseUrl()}/api/derivatives`, { cache: "no-store" });
    const json = await res.json();
    if (!json.available) throw new Error(json.error ?? "Falha ao carregar derivativos");
    return json.data;
  };

  const [coinsResult, newsResult, zScoreResult, categoriesResult, derivativesResult, onChainResult, fearGreedResult] =
    await Promise.allSettled([
      getTopCoinMarkets(100),
      getNews("cripto", 10),
      getZScoreHighlights("cripto"),
      getCoinCategories(),
      fetchDerivatives(),
      getOnChainSnapshot(),
      getFearGreedIndex(),
    ]);

  if (coinsResult.status === "fulfilled") {
    coins = coinsResult.value;
  } else {
    available = false;
    fetchError = coinsResult.reason instanceof Error ? coinsResult.reason.message : "Falha desconhecida";
  }

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const zScoreHighlights = zScoreResult.status === "fulfilled" ? zScoreResult.value : null;
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : null;
  const derivatives = derivativesResult.status === "fulfilled" ? derivativesResult.value : null;
  const onChain = onChainResult.status === "fulfilled" ? onChainResult.value : null;
  const fearGreed = fearGreedResult.status === "fulfilled" ? fearGreedResult.value : null;
  const topSectors = categories
    ? [...categories].filter((c) => c.marketCapChange24h !== null).sort((a, b) => (b.marketCapChange24h ?? 0) - (a.marketCapChange24h ?? 0))
    : null;

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

      <Panel title="Setores — melhores e piores do dia" updatedAt={now}>
        {topSectors ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase text-text-muted">Em alta</h3>
              <ul className="flex flex-col divide-y divide-border/50">
                {topSectors.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-text">{s.name}</span>
                    <span className="text-up">{s.marketCapChange24h?.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase text-text-muted">Em baixa</h3>
              <ul className="flex flex-col divide-y divide-border/50">
                {topSectors.slice(-5).reverse().map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-text">{s.name}</span>
                    <span className="text-down">{s.marketCapChange24h?.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Long / Short Ratio — Perpétuos (Binance Futures)" updatedAt={now}>
          {derivatives && derivatives.length > 0 ? (
            <LongShortPanel items={derivatives} />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>
        <Panel title="Open Interest — Perpétuos (Binance Futures)" updatedAt={now}>
          {derivatives && derivatives.length > 0 ? (
            <OpenInterestPanel items={derivatives} />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>
      </div>

      <Panel title="Funding Rate — Perpétuos (Binance Futures)" updatedAt={now}>
        {derivatives && derivatives.length > 0 ? (
          <FundingRateTable items={derivatives} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="On-Chain — BTC / ETH" updatedAt={now}>
        {onChain && onChain.length > 0 ? (
          <OnChainPanel snapshots={onChain} fearGreed={fearGreed} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

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
