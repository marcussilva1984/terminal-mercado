import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { Panel } from "@/components/Panel";
import { NewsFeed } from "@/components/NewsFeed";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { RankingTable } from "@/components/RankingTable";
import { getTopCoinMarkets, getCoinCategories, getTrendingCoins, type CoinMarket } from "@/lib/sources/coingecko";
import { TrendingCoinsPanel } from "@/components/TrendingCoinsPanel";
import { getOnChainSnapshot, getFearGreedIndex } from "@/lib/sources/onchain";
import { getEtfFlows } from "@/lib/sources/etfFlow";
import { EtfFlowPanel } from "@/components/EtfFlowPanel";
import { getDerivativesCache } from "@/lib/db/derivativesCacheRepo";
import { hasDatabase } from "@/lib/db/client";
import { getNews } from "@/lib/sources/rss";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { formatPrice } from "@/lib/format";
import { LongShortPanel, FundingRateTable, OpenInterestPanel } from "@/components/DerivativesPanel";
import { OnChainPanel } from "@/components/OnChainPanel";
import { buildGenericInsights, fillMinimumInsights } from "@/lib/insights";
import { getProtocolTvl } from "@/lib/sources/defillama";
import { TvlPanel } from "@/components/TvlPanel";
import { getNegativeCryptoSignals } from "@/lib/cryptoNewsSentiment";
import { CryptoSentimentPanel } from "@/components/CryptoSentimentPanel";
import { CRIPTO_WATCHLIST } from "@/lib/watchlist";
import { getWatchlist } from "@/lib/db/watchlistRepo";
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
    price: metric !== "price" ? coin.current_price : undefined,
  };
}

export default async function CriptoPage() {
  let coins: CoinMarket[] = [];
  let available = true;
  let fetchError: string | undefined;

  // Lê o cache no banco em vez de chamar a Binance ao vivo — chamadas
  // server-to-server pra Binance de dentro da Vercel falham sempre (parece
  // bloqueio de IP), mesmo a mesma rota funcionando perfeitamente quando
  // acessada de fora. Um job externo (GitHub Actions) atualiza esse cache
  // a cada 15min batendo na rota pública.
  const fetchDerivatives = async () => {
    if (!hasDatabase()) throw new Error("DATABASE_URL não configurada");
    const cache = await getDerivativesCache();
    if (!cache) throw new Error("Cache de derivativos ainda vazio — aguardando primeira rodada do job externo");
    return cache;
  };

  const criptoWatchlist = hasDatabase()
    ? (() => {
        const merged = [...CRIPTO_WATCHLIST];
        const seen = new Set(merged.map((w) => w.symbol));
        return getWatchlist("cripto").then((db) => {
          for (const w of db) if (!seen.has(w.symbol)) merged.push(w);
          return merged;
        });
      })()
    : Promise.resolve(CRIPTO_WATCHLIST);

  const [coinsResult, newsResult, zScoreResult, categoriesResult, derivativesResult, onChainResult, fearGreedResult, etfFlowResult, trendingResult, tvlResult, sentimentResult] =
    await Promise.allSettled([
      getTopCoinMarkets(100),
      getNews("cripto", 10),
      getZScoreHighlights("cripto"),
      getCoinCategories(),
      fetchDerivatives(),
      getOnChainSnapshot(),
      getFearGreedIndex(),
      getEtfFlows(),
      getTrendingCoins(),
      criptoWatchlist.then((w) => getProtocolTvl(w.map((x) => x.symbol))),
      criptoWatchlist.then((w) => getNegativeCryptoSignals(w)),
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
  const derivatives = derivativesResult.status === "fulfilled" ? derivativesResult.value.data : null;
  const derivativesUpdatedAt = derivativesResult.status === "fulfilled" ? derivativesResult.value.updatedAt : null;
  const onChain = onChainResult.status === "fulfilled" ? onChainResult.value : null;
  const fearGreed = fearGreedResult.status === "fulfilled" ? fearGreedResult.value : null;
  const etfFlows = etfFlowResult.status === "fulfilled" ? etfFlowResult.value : null;
  const trending = trendingResult.status === "fulfilled" ? trendingResult.value : null;
  const tvl = tvlResult.status === "fulfilled" ? tvlResult.value : null;
  const cryptoSentiment = sentimentResult.status === "fulfilled" ? sentimentResult.value : null;
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

  // Volume anormal: proxy simples de volume/market cap — quanto maior, mais
  // "quente" o interesse do dia relativo ao tamanho da moeda (filtra micro
  // caps abaixo de US$ 50mi de market cap pra evitar ruído).
  const byVolumeRatio = [...coins]
    .filter((c) => c.market_cap >= 50_000_000)
    .map((c) => ({
      symbol: c.symbol.toUpperCase(),
      label: c.name,
      value: c.total_volume / c.market_cap,
      changePct: c.price_change_percentage_24h ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const insights: string[] = buildGenericInsights(
    gainers,
    losers,
    byVolume,
    zScoreHighlights ?? []
  );

  if (byVolumeRatio[0]) {
    insights.push(
      `${byVolumeRatio[0].symbol} com volume/market cap de ${(byVolumeRatio[0].value * 100).toFixed(0)}% — atividade de negociação desproporcional ao tamanho da moeda hoje.`
    );
  }

  if (topSectors && topSectors.length > 0) {
    const bestSector = topSectors[0];
    if (bestSector.marketCapChange24h !== null && bestSector.marketCapChange24h > 0) {
      insights.push(`Setor ${bestSector.name} lidera o dia (${bestSector.marketCapChange24h.toFixed(2)}%).`);
    }
  }

  const derivatives0 = derivatives ?? [];
  const extremeFunding = derivatives0.find((d) => Math.abs(d.fundingRatePct) >= 0.05);
  if (extremeFunding) {
    const direction = extremeFunding.fundingRatePct > 0 ? "comprado" : "vendido";
    insights.push(
      `Funding rate de ${extremeFunding.symbol} em ${extremeFunding.fundingRatePct.toFixed(3)}% — mercado de perpétuos ${direction} demais, risco de liquidação em cascata.`
    );
  }

  const btcOnChain = onChain?.find((o) => o.asset === "BTC");
  if (btcOnChain?.mvrv !== null && btcOnChain?.mvrv !== undefined) {
    if (btcOnChain.mvrv >= 3.5) insights.push(`BTC com MVRV em ${btcOnChain.mvrv.toFixed(2)} — zona historicamente associada a topos de ciclo.`);
    else if (btcOnChain.mvrv <= 1) insights.push(`BTC com MVRV em ${btcOnChain.mvrv.toFixed(2)} — zona historicamente associada a fundos de ciclo.`);
  }

  if (fearGreed) {
    if (fearGreed.value <= 20) insights.push(`Fear & Greed Index em ${fearGreed.value} (medo extremo) — historicamente zona de acumulação, não de pânico vender.`);
    else if (fearGreed.value >= 80) insights.push(`Fear & Greed Index em ${fearGreed.value} (ganância extrema) — historicamente zona de cautela.`);
  }

  const finalInsights = fillMinimumInsights(insights, [...gainers, ...losers]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Cripto</h1>
        <p className="mt-1 text-sm text-text-muted">Dados reais via CoinGecko (delay curto, sem chave de API).</p>
      </div>

      {finalInsights.length > 0 && (
        <Panel title="Insights do Dia" updatedAt={now}>
          <ul className="flex flex-col gap-2 text-sm text-text">
            {finalInsights.map((insight, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-bright">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Trending — Onde a Atenção Está" updatedAt={now}>
        {trending ? <TrendingCoinsPanel items={trending} /> : <p className="text-sm text-down">Fonte indisponível no momento.</p>}
      </Panel>

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
          assetClass="cripto"
        />
        <RankingPanel
          title="Maiores Baixas 24h"
          items={losers}
          updatedAt={now}
          valueLabel="Preço (US$)"
          format="price-usd"
          assetClass="cripto"
        />
        <RankingPanel
          title="Maiores Volumes 24h"
          items={byVolume}
          updatedAt={now}
          valueLabel="Volume 24h"
          format="compact-usd"
          assetClass="cripto"
        />
        <RankingPanel
          title="Top Market Cap"
          items={byMarketCap}
          updatedAt={now}
          valueLabel="Market Cap"
          format="compact-usd"
          assetClass="cripto"
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
        <Panel title="Long / Short Ratio — Perpétuos (Binance Futures)" updatedAt={derivativesUpdatedAt ?? now}>
          {derivatives && derivatives.length > 0 ? (
            <LongShortPanel items={derivatives} />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>
        <Panel title="Open Interest — Perpétuos (Binance Futures)" updatedAt={derivativesUpdatedAt ?? now}>
          {derivatives && derivatives.length > 0 ? (
            <OpenInterestPanel items={derivatives} />
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>
      </div>

      <Panel title="Funding Rate — Perpétuos (Binance Futures)" updatedAt={derivativesUpdatedAt ?? now}>
        {derivatives && derivatives.length > 0 ? (
          <FundingRateTable items={derivatives} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
        {derivatives && derivatives.length > 0 && (
          <p className="mt-3 text-xs text-text-muted">
            Atualizado a cada ~15min via job externo (a Binance bloqueia chamada direta de dentro da
            Vercel) — os 3 painéis de derivativos acima usam o mesmo cache.
          </p>
        )}
      </Panel>

      <Panel title="On-Chain — BTC / ETH" updatedAt={now}>
        {onChain && onChain.length > 0 ? (
          <OnChainPanel snapshots={onChain} fearGreed={fearGreed} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="Fluxo de ETFs Spot (EUA)" updatedAt={now}>
        {etfFlows && etfFlows.length > 0 ? (
          <EtfFlowPanel items={etfFlows} />
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
        <Panel title="Volume Anormal (top 100 por market cap)" updatedAt={now}>
          <RankingTable
            items={byVolumeRatio}
            valueLabel="Volume/Market Cap"
            format="percent-of-1"
          />
          <p className="mt-3 text-xs text-text-muted">
            Proxy simples: volume 24h dividido pelo market cap. Quanto maior, mais desproporcional o
            interesse de negociação hoje frente ao tamanho normal da moeda — filtra moedas abaixo de
            US$ 50mi de market cap pra evitar ruído de micro caps.
          </p>
        </Panel>
      </div>

      <Panel title="TVL por Protocolo — Watchlist" updatedAt={now}>
        {tvl ? <TvlPanel items={tvl} /> : <p className="text-sm text-down">Fonte indisponível no momento.</p>}
      </Panel>

      <Panel title="Sentimento de Notícias — Watchlist (7 dias)" updatedAt={now}>
        {cryptoSentiment ? (
          <CryptoSentimentPanel items={cryptoSentiment} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="Notícias Cripto" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
