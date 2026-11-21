import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { Panel } from "@/components/Panel";
import { getTopCoinMarkets, getCoinCategories, getTrendingCoins, getGlobalCryptoData, type CoinMarket } from "@/lib/sources/coingecko";
import { TrendingCoinsPanel } from "@/components/TrendingCoinsPanel";
import { getOnChainSnapshot, getFearGreedIndex } from "@/lib/sources/onchain";
import { getEtfFlows } from "@/lib/sources/etfFlow";
import { EtfFlowPanel } from "@/components/EtfFlowPanel";
import { getDerivativesCache } from "@/lib/db/derivativesCacheRepo";
import { hasDatabase } from "@/lib/db/client";
import { formatPrice } from "@/lib/format";
import { FundingRateTable, OpenInterestPanel } from "@/components/DerivativesPanel";
import { OnChainPanel } from "@/components/OnChainPanel";
import { buildGenericInsights, fillMinimumInsights } from "@/lib/insights";
import { getProtocolTvl } from "@/lib/sources/defillama";
import { TvlPanel } from "@/components/TvlPanel";
import { CRIPTO_WATCHLIST } from "@/lib/watchlist";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { getCriptoMoneyFlowIdeas } from "@/lib/moneyFlowIdeas";
import { MoneyFlowIdeasList } from "@/components/MoneyFlowIdeasList";
import { InsightsList } from "@/components/InsightsList";
import { BtcDominanceBar } from "@/components/BtcDominanceBar";
import { CriptoCycleMeter } from "@/components/CriptoCycleMeter";
import { BtcCorrelationTable } from "@/components/BtcCorrelationTable";
import { getBtcCorrelations } from "@/lib/btcCorrelation";
import type { RankingItem } from "@/lib/types";

export const revalidate = 240;

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

  const [
    coinsResult,
    derivativesResult,
    onChainResult,
    fearGreedResult,
    etfFlowResult,
    trendingResult,
    tvlResult,
    ideasResult,
    globalResult,
    categoriesResult,
    correlationResult,
  ] = await Promise.allSettled([
    getTopCoinMarkets(100),
    hasDatabase() ? getDerivativesCache() : Promise.resolve(null),
    getOnChainSnapshot(),
    getFearGreedIndex(),
    getEtfFlows(),
    getTrendingCoins(),
    criptoWatchlist.then((w) => getProtocolTvl(w.map((x) => x.symbol))),
    getCriptoMoneyFlowIdeas(),
    getGlobalCryptoData(),
    getCoinCategories(),
    criptoWatchlist.then((w) => getBtcCorrelations(w)),
  ]);

  if (coinsResult.status === "fulfilled") {
    coins = coinsResult.value;
  } else {
    available = false;
    fetchError = coinsResult.reason instanceof Error ? coinsResult.reason.message : "Falha desconhecida";
  }

  const derivatives = derivativesResult.status === "fulfilled" ? (derivativesResult.value?.data ?? null) : null;
  const derivativesUpdatedAt = derivativesResult.status === "fulfilled" ? (derivativesResult.value?.updatedAt ?? null) : null;
  const onChain = onChainResult.status === "fulfilled" ? onChainResult.value : [];
  const fearGreed = fearGreedResult.status === "fulfilled" ? fearGreedResult.value : null;
  const etfFlows = etfFlowResult.status === "fulfilled" ? etfFlowResult.value : null;
  const trending = trendingResult.status === "fulfilled" ? trendingResult.value : null;
  const tvl = tvlResult.status === "fulfilled" ? tvlResult.value : null;
  const moneyFlowIdeas = ideasResult.status === "fulfilled" ? ideasResult.value : null;
  const global = globalResult.status === "fulfilled" ? globalResult.value : null;
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : null;
  const correlations = correlationResult.status === "fulfilled" ? correlationResult.value : [];

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

  const insights: string[] = buildGenericInsights(gainers, losers, byVolume, []);

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
      `Funding rate de ${extremeFunding.symbol} em ${extremeFunding.fundingRatePct.toFixed(3)}% — mercado de perpétuos ${direction} demais.`
    );
  }

  const btcOnChain = onChain?.find((o) => o.asset === "BTC");
  if (btcOnChain?.mvrv !== null && btcOnChain?.mvrv !== undefined) {
    if (btcOnChain.mvrv >= 3.5) insights.push(`BTC com MVRV em ${btcOnChain.mvrv.toFixed(2)} — zona historicamente associada a topos de ciclo.`);
    else if (btcOnChain.mvrv <= 1) insights.push(`BTC com MVRV em ${btcOnChain.mvrv.toFixed(2)} — zona historicamente associada a fundos de ciclo.`);
  }

  if (fearGreed) {
    if (fearGreed.value <= 20) insights.push(`Fear & Greed em ${fearGreed.value} (medo extremo) — zona histórica de acumulação.`);
    else if (fearGreed.value >= 80) insights.push(`Fear & Greed em ${fearGreed.value} (ganância extrema) — zona histórica de cautela.`);
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
          <InsightsList items={finalInsights} />
        </Panel>
      )}

      {/* ── NOVO: Dominância BTC/ETH/Alts ─────────────────────────────── */}
      {global && (
        <Panel title="Dominância de Mercado" updatedAt={now}>
          <BtcDominanceBar global={global} />
        </Panel>
      )}

      {/* ── NOVO: Semáforo de Ciclo ────────────────────────────────────── */}
      <Panel title="Semáforo de Ciclo" updatedAt={now}>
        <CriptoCycleMeter
          global={global}
          onChain={onChain ?? []}
          fearGreed={fearGreed}
          derivatives={derivatives ?? []}
        />
      </Panel>

      <Panel title="Onde o Dinheiro Está Indo" updatedAt={now}>
        {moneyFlowIdeas ? (
          <MoneyFlowIdeasList items={moneyFlowIdeas} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="Trending — Onde a Atenção Está" updatedAt={now}>
        {trending ? (
          <>
            <TrendingCoinsPanel items={trending} />
            <p className="mt-2 text-xs text-text-muted">
              Top buscas e menções nas últimas 24h via CoinGecko — reflete interesse de varejo, não institucional.
            </p>
          </>
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
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
        <RankingPanel title="Maiores Altas 24h" items={gainers} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" assetClass="cripto" />
        <RankingPanel title="Maiores Baixas 24h" items={losers} updatedAt={now} valueLabel="Preço (US$)" format="price-usd" assetClass="cripto" />
        <RankingPanel title="Maiores Volumes 24h" items={byVolume} updatedAt={now} valueLabel="Volume 24h" format="compact-usd" assetClass="cripto" />
        <RankingPanel title="Top Market Cap" items={byMarketCap} updatedAt={now} valueLabel="Market Cap" format="compact-usd" assetClass="cripto" />
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

      {/* ── NOVO: Correlação BTC vs Alts ──────────────────────────────── */}
      <Panel title="Correlação com BTC — Watchlist (30d)" updatedAt={now}>
        <BtcCorrelationTable items={correlations} />
      </Panel>

      <Panel title="Open Interest — Perpétuos Binance" updatedAt={derivativesUpdatedAt ?? now}>
        {derivatives && derivatives.length > 0 ? (
          <OpenInterestPanel items={derivatives} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="Funding Rate — Perpétuos Binance" updatedAt={derivativesUpdatedAt ?? now}>
        {derivatives && derivatives.length > 0 ? (
          <>
            <FundingRateTable items={derivatives} />
            <p className="mt-3 text-xs text-text-muted">
              Funding positivo = longs pagando shorts (mercado comprado demais); negativo = crowded short.
              Coletado a cada 15 min via GitHub Actions (Binance recusa chamadas diretas da Vercel).
            </p>
          </>
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

      <Panel title="Fluxo de ETFs Spot (EUA)" updatedAt={now}>
        {etfFlows && etfFlows.length > 0 ? (
          <EtfFlowPanel items={etfFlows} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="TVL por Protocolo — Watchlist" updatedAt={now}>
        {tvl ? <TvlPanel items={tvl} /> : <p className="text-sm text-down">Fonte indisponível no momento.</p>}
      </Panel>
    </div>
  );
}
