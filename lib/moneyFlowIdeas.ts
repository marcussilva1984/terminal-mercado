import { getZScoreHighlights } from "@/lib/zscoreService";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";
import { getTopCoinMarkets, getTrendingCoins } from "@/lib/sources/coingecko";
import { getProtocolTvl } from "@/lib/sources/defillama";
import { getNegativeCryptoSignals } from "@/lib/cryptoNewsSentiment";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";
import { matchFatosRelevantes } from "@/lib/valuation";
import { getB3VolatilityRanking } from "@/lib/volatilityService";
import { getBaseUrl } from "@/lib/baseUrl";
import { CRIPTO_WATCHLIST, B3_WATCHLIST } from "@/lib/watchlist";
import type { AnalystTarget } from "@/lib/sources/yahooAnalyst";

// "Onde o dinheiro está indo" — não é fluxo real de investidor (isso não
// existe de graça, nem pra B3 nem pra cripto), é um agregado de sinais que
// JÁ calculamos em outros painéis (z-score, volume/TVL anormal, atenção,
// notícia, preço-alvo, fluxo agregado) pro mesmo ativo ao mesmo tempo.
// Convicção = quantos sinais reais bateram juntos, não uma opinião solta.
export type ConvictionLevel = "forte" | "medio" | "fraco";

export interface MoneyFlowIdea {
  symbol: string;
  label: string;
  assetClass: string;
  changePct: number;
  conviction: ConvictionLevel;
  signals: string[];
  explanation: string;
}

function convictionFromCount(n: number): ConvictionLevel {
  if (n >= 3) return "forte";
  if (n === 2) return "medio";
  return "fraco";
}

function buildIdea(
  symbol: string,
  label: string,
  assetClass: string,
  changePct: number,
  signals: string[]
): MoneyFlowIdea | null {
  if (signals.length === 0) return null;
  const direction = changePct >= 0 ? "alta" : "queda";
  return {
    symbol,
    label,
    assetClass,
    changePct,
    conviction: convictionFromCount(signals.length),
    signals,
    explanation: `${direction === "alta" ? "Subindo" : "Caindo"} ${Math.abs(changePct).toFixed(1)}% — ${signals.join("; ")}.`,
  };
}

export async function getCriptoMoneyFlowIdeas(): Promise<MoneyFlowIdea[]> {
  const watchlist = hasDatabase() ? await getWatchlist("cripto") : CRIPTO_WATCHLIST.map((w, i) => ({ ...w, id: i }));
  const symbols = watchlist.map((w) => w.symbol);
  const labelBySymbol = new Map(watchlist.map((w) => [w.symbol, w.label]));

  const [zScoreResult, marketsResult, trendingResult, tvlResult, negativeResult] = await Promise.allSettled([
    getZScoreHighlights("cripto"),
    getTopCoinMarkets(250),
    getTrendingCoins(),
    getProtocolTvl(symbols),
    getNegativeCryptoSignals(watchlist),
  ]);

  const zScores = zScoreResult.status === "fulfilled" ? zScoreResult.value : [];
  const markets = marketsResult.status === "fulfilled" ? marketsResult.value : [];
  const trending = trendingResult.status === "fulfilled" ? new Set(trendingResult.value.map((t) => t.symbol)) : new Set<string>();
  const tvl = tvlResult.status === "fulfilled" ? tvlResult.value : [];
  const negative = negativeResult.status === "fulfilled" ? negativeResult.value : [];

  const signalsBySymbol = new Map<string, string[]>();
  const changePctBySymbol = new Map<string, number>();
  const add = (symbol: string, changePct: number, signal: string) => {
    if (!signalsBySymbol.has(symbol)) signalsBySymbol.set(symbol, []);
    signalsBySymbol.get(symbol)!.push(signal);
    changePctBySymbol.set(symbol, changePct);
  };

  for (const z of zScores) {
    if (Math.abs(z.zScore) >= 1.5) {
      add(z.symbol, z.changePct, `z-score |${z.zScore.toFixed(1)}| fora do padrão da watchlist`);
    }
  }

  for (const symbol of symbols) {
    const m = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
    if (!m || !m.market_cap) continue;
    const volToMcapPct = (m.total_volume / m.market_cap) * 100;
    if (volToMcapPct >= 15) {
      add(symbol, m.price_change_percentage_24h ?? 0, `volume/market cap de ${volToMcapPct.toFixed(0)}% hoje (negociação desproporcional ao tamanho)`);
    }
  }

  for (const t of tvl) {
    if (t.change1dPct !== null && Math.abs(t.change1dPct) >= 5) {
      const m = markets.find((c) => c.symbol.toLowerCase() === t.symbol.toLowerCase());
      add(t.symbol, m?.price_change_percentage_24h ?? 0, `TVL do protocolo variou ${t.change1dPct >= 0 ? "+" : ""}${t.change1dPct.toFixed(1)}% em 24h`);
    }
  }

  for (const symbol of symbols) {
    if (trending.has(symbol)) {
      const m = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
      add(symbol, m?.price_change_percentage_24h ?? 0, "entre as moedas mais buscadas na CoinGecko agora");
    }
  }

  for (const n of negative) {
    if (n.count > 0) {
      const m = markets.find((c) => c.symbol.toLowerCase() === n.symbol.toLowerCase());
      add(n.symbol, m?.price_change_percentage_24h ?? 0, `${n.count} notícia(s) recente(s) com tom de crise citando o ativo`);
    }
  }

  const ideas: MoneyFlowIdea[] = [];
  for (const [symbol, signals] of signalsBySymbol) {
    const idea = buildIdea(symbol, labelBySymbol.get(symbol) ?? symbol, "cripto", changePctBySymbol.get(symbol) ?? 0, signals);
    if (idea) ideas.push(idea);
  }

  ideas.sort((a, b) => b.signals.length - a.signals.length || Math.abs(b.changePct) - Math.abs(a.changePct));
  return ideas.slice(0, 15);
}

export async function getB3MoneyFlowIdeas(): Promise<MoneyFlowIdea[]> {
  const watchlist = hasDatabase() ? await getWatchlist("b3") : B3_WATCHLIST.map((w, i) => ({ ...w, id: i }));
  const labelBySymbol = new Map(watchlist.map((w) => [w.symbol, w.label]));

  const [zScoreResult, volatilityResult, fatosResult, priceTargetResult] = await Promise.allSettled([
    getZScoreHighlights("b3"),
    getB3VolatilityRanking(),
    getFatosRelevantes(60),
    (async () => {
      const symbols = watchlist.map((w) => `${w.symbol}.SA`).join(",");
      const res = await fetch(`${getBaseUrl()}/api/analyst-targets?symbols=${encodeURIComponent(symbols)}`, {
        next: { revalidate: 120 },
      });
      const json = await res.json();
      if (!json.available) return [];
      return json.data as AnalystTarget[];
    })(),
  ]);

  const zScores = zScoreResult.status === "fulfilled" ? zScoreResult.value : [];
  const volatility = volatilityResult.status === "fulfilled" ? volatilityResult.value : [];
  const fatos = fatosResult.status === "fulfilled" ? fatosResult.value : [];
  const priceTargets = priceTargetResult.status === "fulfilled" ? priceTargetResult.value : [];

  const fatosMatches = matchFatosRelevantes(watchlist, fatos);
  const fatosBySymbol = new Map(fatosMatches.map((m) => [m.symbol, m]));

  const signalsBySymbol = new Map<string, string[]>();
  const changePctBySymbol = new Map<string, number>();
  const add = (symbol: string, changePct: number, signal: string) => {
    if (!signalsBySymbol.has(symbol)) signalsBySymbol.set(symbol, []);
    signalsBySymbol.get(symbol)!.push(signal);
    changePctBySymbol.set(symbol, changePct);
  };

  for (const z of zScores) {
    if (Math.abs(z.zScore) >= 1.5) {
      add(z.symbol, z.changePct, `z-score |${z.zScore.toFixed(1)}| fora do padrão da watchlist`);
    }
  }

  for (const v of volatility) {
    if (v.vol1w >= 5) {
      add(v.symbol, v.lastChangePct, `volatilidade de ${v.vol1w.toFixed(1)}% na última semana (acima do normal)`);
    }
  }

  for (const [symbol, fato] of fatosBySymbol) {
    add(symbol, changePctBySymbol.get(symbol) ?? 0, `Fato Relevante CVM: "${fato.subject}" (${fato.date})`);
  }

  for (const t of priceTargets) {
    if (t.currentPrice !== null && t.targetMeanPrice !== null && t.currentPrice >= t.targetMeanPrice) {
      const symbol = t.symbol.replace(".SA", "");
      add(symbol, changePctBySymbol.get(symbol) ?? 0, "preço já bateu o alvo médio dos analistas");
    }
  }

  const ideas: MoneyFlowIdea[] = [];
  for (const [symbol, signals] of signalsBySymbol) {
    const idea = buildIdea(symbol, labelBySymbol.get(symbol) ?? symbol, "b3", changePctBySymbol.get(symbol) ?? 0, signals);
    if (idea) ideas.push(idea);
  }

  ideas.sort((a, b) => b.signals.length - a.signals.length || Math.abs(b.changePct) - Math.abs(a.changePct));
  return ideas.slice(0, 15);
}
