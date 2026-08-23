import { unstable_cache } from "next/cache";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";
import { getTopCoinMarkets, getTrendingCoins } from "@/lib/sources/coingecko";
import { getProtocolTvl } from "@/lib/sources/defillama";
import { getNegativeCryptoSignals } from "@/lib/cryptoNewsSentiment";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";
import { matchFatosRelevantes } from "@/lib/valuation";
import { getB3VolatilityRanking } from "@/lib/volatilityService";
import { getFiiDividendYieldRanking } from "@/lib/sources/investidor10";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { computeVolatility } from "@/lib/volatility";
import { getBaseUrl } from "@/lib/baseUrl";
import { CRIPTO_WATCHLIST, B3_WATCHLIST, FII_WATCHLIST } from "@/lib/watchlist";
import type { AnalystTarget } from "@/lib/sources/yahooAnalyst";
import type { ZScoreHighlight } from "@/lib/types";

// "Onde o dinheiro está indo" — não é fluxo real de investidor (isso não
// existe de graça, nem pra B3 nem pra cripto), é um agregado de sinais que
// JÁ calculamos em outros painéis (z-score, volume/TVL anormal, atenção,
// notícia, preço-alvo, dividend yield, volatilidade) pro mesmo ativo ao
// mesmo tempo. Convicção = quantos sinais reais bateram juntos, não uma
// opinião solta.
export type ConvictionLevel = "forte" | "medio" | "fraco";
export type Rationale = "smart_money" | "fundamento" | "misto" | "sem_sinal";

interface Signal {
  text: string;
  type: "smart_money" | "fundamento";
}

export interface MoneyFlowIdea {
  symbol: string;
  label: string;
  assetClass: string;
  changePct: number;
  conviction: ConvictionLevel;
  rationale: Rationale;
  signals: string[];
  explanation: string;
}

const MIN_IDEAS_PER_CLASS = 10;
const MAX_IDEAS_PER_CLASS = 15;

function convictionFromCount(n: number): ConvictionLevel {
  if (n >= 3) return "forte";
  if (n === 2) return "medio";
  return "fraco";
}

function rationaleFromSignals(signals: Signal[]): Rationale {
  if (signals.length === 0) return "sem_sinal";
  const hasSmartMoney = signals.some((s) => s.type === "smart_money");
  const hasFundamento = signals.some((s) => s.type === "fundamento");
  if (hasSmartMoney && hasFundamento) return "misto";
  return hasSmartMoney ? "smart_money" : "fundamento";
}

function buildIdea(symbol: string, label: string, assetClass: string, changePct: number, signals: Signal[]): MoneyFlowIdea {
  const direction = changePct >= 0 ? "Subindo" : "Caindo";
  const texts = signals.map((s) => s.text);
  const explanation =
    signals.length > 0
      ? `${direction} ${Math.abs(changePct).toFixed(1)}% — ${texts.join("; ")}.`
      : `${direction} ${Math.abs(changePct).toFixed(1)}% — maior variação da watchlist no momento, sem outro sinal batendo além do preço.`;

  return {
    symbol,
    label,
    assetClass,
    changePct,
    conviction: convictionFromCount(signals.length),
    rationale: rationaleFromSignals(signals),
    signals: texts,
    explanation,
  };
}

// Completa até o mínimo com os próximos maiores |z-score| da watchlist que
// ainda não entraram — mesmo dado já coletado (nunca inventa sinal novo),
// só garante volume mínimo de ideias mesmo num dia sem muito destaque.
function ensureMinimum(
  ideas: MoneyFlowIdea[],
  assetClass: string,
  zScores: ZScoreHighlight[],
  labelBySymbol: Map<string, string>
): MoneyFlowIdea[] {
  if (ideas.length >= MIN_IDEAS_PER_CLASS) return ideas;
  const existing = new Set(ideas.map((i) => i.symbol));
  const remaining = [...zScores].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  for (const z of remaining) {
    if (ideas.length >= MIN_IDEAS_PER_CLASS) break;
    if (existing.has(z.symbol)) continue;
    existing.add(z.symbol);
    ideas.push(buildIdea(z.symbol, labelBySymbol.get(z.symbol) ?? z.label, assetClass, z.changePct, []));
  }
  return ideas;
}

function finalize(
  signalsBySymbol: Map<string, Signal[]>,
  changePctBySymbol: Map<string, number>,
  labelBySymbol: Map<string, string>,
  assetClass: string,
  zScores: ZScoreHighlight[]
): MoneyFlowIdea[] {
  let ideas: MoneyFlowIdea[] = [];
  for (const [symbol, signals] of signalsBySymbol) {
    ideas.push(buildIdea(symbol, labelBySymbol.get(symbol) ?? symbol, assetClass, changePctBySymbol.get(symbol) ?? 0, signals));
  }
  ideas.sort((a, b) => b.signals.length - a.signals.length || Math.abs(b.changePct) - Math.abs(a.changePct));
  ideas = ensureMinimum(ideas, assetClass, zScores, labelBySymbol);
  ideas.sort((a, b) => b.signals.length - a.signals.length || Math.abs(b.changePct) - Math.abs(a.changePct));
  return ideas.slice(0, MAX_IDEAS_PER_CLASS);
}

async function computeCriptoMoneyFlowIdeas(): Promise<MoneyFlowIdea[]> {
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

  const signalsBySymbol = new Map<string, Signal[]>();
  const changePctBySymbol = new Map<string, number>();
  const add = (symbol: string, changePct: number, signal: Signal) => {
    if (!signalsBySymbol.has(symbol)) signalsBySymbol.set(symbol, []);
    signalsBySymbol.get(symbol)!.push(signal);
    changePctBySymbol.set(symbol, changePct);
  };

  for (const z of zScores) {
    if (Math.abs(z.zScore) >= 1.5) {
      add(z.symbol, z.changePct, { type: "smart_money", text: `z-score |${z.zScore.toFixed(1)}| fora do padrão da watchlist` });
    }
  }

  for (const symbol of symbols) {
    const m = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
    if (!m || !m.market_cap) continue;
    const volToMcapPct = (m.total_volume / m.market_cap) * 100;
    if (volToMcapPct >= 15) {
      add(symbol, m.price_change_percentage_24h ?? 0, {
        type: "smart_money",
        text: `volume/market cap de ${volToMcapPct.toFixed(0)}% hoje (negociação desproporcional ao tamanho)`,
      });
    }
  }

  for (const t of tvl) {
    if (t.change1dPct !== null && Math.abs(t.change1dPct) >= 5) {
      const m = markets.find((c) => c.symbol.toLowerCase() === t.symbol.toLowerCase());
      add(t.symbol, m?.price_change_percentage_24h ?? 0, {
        type: "smart_money",
        text: `TVL do protocolo variou ${t.change1dPct >= 0 ? "+" : ""}${t.change1dPct.toFixed(1)}% em 24h`,
      });
    }
  }

  for (const symbol of symbols) {
    if (trending.has(symbol)) {
      const m = markets.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
      add(symbol, m?.price_change_percentage_24h ?? 0, { type: "smart_money", text: "entre as moedas mais buscadas na CoinGecko agora" });
    }
  }

  for (const n of negative) {
    if (n.count > 0) {
      const m = markets.find((c) => c.symbol.toLowerCase() === n.symbol.toLowerCase());
      add(n.symbol, m?.price_change_percentage_24h ?? 0, {
        type: "fundamento",
        text: `${n.count} notícia(s) recente(s) com tom de crise citando o ativo`,
      });
    }
  }

  return finalize(signalsBySymbol, changePctBySymbol, labelBySymbol, "cripto", zScores);
}

async function computeB3MoneyFlowIdeas(): Promise<MoneyFlowIdea[]> {
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

  const signalsBySymbol = new Map<string, Signal[]>();
  const changePctBySymbol = new Map<string, number>();
  const add = (symbol: string, changePct: number, signal: Signal) => {
    if (!signalsBySymbol.has(symbol)) signalsBySymbol.set(symbol, []);
    signalsBySymbol.get(symbol)!.push(signal);
    changePctBySymbol.set(symbol, changePct);
  };

  for (const z of zScores) {
    if (Math.abs(z.zScore) >= 1.5) {
      add(z.symbol, z.changePct, { type: "smart_money", text: `z-score |${z.zScore.toFixed(1)}| fora do padrão da watchlist` });
    }
  }

  for (const v of volatility) {
    if (v.vol1w >= 5) {
      add(v.symbol, v.lastChangePct, { type: "smart_money", text: `volatilidade de ${v.vol1w.toFixed(1)}% na última semana (acima do normal)` });
    }
  }

  for (const [symbol, fato] of fatosBySymbol) {
    add(symbol, changePctBySymbol.get(symbol) ?? 0, { type: "fundamento", text: `Fato Relevante CVM: "${fato.subject}" (${fato.date})` });
  }

  for (const t of priceTargets) {
    if (t.currentPrice !== null && t.targetMeanPrice !== null && t.currentPrice >= t.targetMeanPrice) {
      const symbol = t.symbol.replace(".SA", "");
      add(symbol, changePctBySymbol.get(symbol) ?? 0, { type: "fundamento", text: "preço já bateu o alvo médio dos analistas" });
    }
  }

  return finalize(signalsBySymbol, changePctBySymbol, labelBySymbol, "b3", zScores);
}

async function computeFiiMoneyFlowIdeas(): Promise<MoneyFlowIdea[]> {
  const watchlist = hasDatabase() ? await getWatchlist("fii") : FII_WATCHLIST.map((w, i) => ({ ...w, id: i }));
  const labelBySymbol = new Map(watchlist.map((w) => [w.symbol, w.label]));

  const [zScoreResult, dyResult, volatilityResult] = await Promise.allSettled([
    getZScoreHighlights("fii"),
    getFiiDividendYieldRanking(30),
    (async () => {
      if (!hasDatabase()) return [];
      const fetched = await Promise.all(watchlist.map(async (w) => ({ w, closes: await getCloses(w.symbol, "fii", 30) })));
      return fetched
        .map(({ w, closes }) => (closes.length >= 2 ? computeVolatility(w.symbol, w.label, closes.map((c) => c.closePrice)) : null))
        .filter((v): v is NonNullable<typeof v> => v !== null);
    })(),
  ]);

  const zScores = zScoreResult.status === "fulfilled" ? zScoreResult.value : [];
  const dyList = dyResult.status === "fulfilled" ? dyResult.value : [];
  const volatility = volatilityResult.status === "fulfilled" ? volatilityResult.value : [];

  const signalsBySymbol = new Map<string, Signal[]>();
  const changePctBySymbol = new Map<string, number>();
  const add = (symbol: string, changePct: number, signal: Signal) => {
    if (!signalsBySymbol.has(symbol)) signalsBySymbol.set(symbol, []);
    signalsBySymbol.get(symbol)!.push(signal);
    changePctBySymbol.set(symbol, changePct);
  };

  for (const z of zScores) {
    if (Math.abs(z.zScore) >= 1.5) {
      add(z.symbol, z.changePct, { type: "smart_money", text: `z-score |${z.zScore.toFixed(1)}| fora do padrão da watchlist` });
    }
  }

  for (const v of volatility) {
    if (v.vol1w >= 3) {
      add(v.symbol, v.lastChangePct, { type: "smart_money", text: `volatilidade de ${v.vol1w.toFixed(1)}% na última semana (acima do normal pra FII)` });
    }
  }

  // DY acima de 25%/ano é quase sempre anomalia de dado (mesmo filtro já
  // aplicado nos insights da aba FII) — não usa como sinal de fundamento
  // pra não emprestar credibilidade a um número provavelmente fora da curva.
  for (const dy of dyList) {
    if (dy.dividendYieldPct > 0 && dy.dividendYieldPct <= 25 && labelBySymbol.has(dy.symbol)) {
      add(dy.symbol, changePctBySymbol.get(dy.symbol) ?? 0, {
        type: "fundamento",
        text: `dividend yield de ${dy.dividendYieldPct.toFixed(1)}% (12m) entre os maiores do mercado`,
      });
    }
  }

  return finalize(signalsBySymbol, changePctBySymbol, labelBySymbol, "fii", zScores);
}

// Cada uma dessas funções soma várias fontes externas pesadas (CoinGecko,
// DefiLlama, CVM, brapi, varredura de notícia) por cima do que a página já
// busca — sem cache, cada carregamento de página recalculava tudo do zero,
// o que na prática significava 15-25s por navegação (medido em produção).
// Mesmo padrão de cache já usado pro z-score/SMA200/TVL da watchlist.
export const getCriptoMoneyFlowIdeas = unstable_cache(computeCriptoMoneyFlowIdeas, ["cripto-money-flow-ideas"], {
  revalidate: 5 * 60,
});
export const getB3MoneyFlowIdeas = unstable_cache(computeB3MoneyFlowIdeas, ["b3-money-flow-ideas"], {
  revalidate: 5 * 60,
});
export const getFiiMoneyFlowIdeas = unstable_cache(computeFiiMoneyFlowIdeas, ["fii-money-flow-ideas"], {
  revalidate: 5 * 60,
});
