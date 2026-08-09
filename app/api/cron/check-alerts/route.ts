import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { hasRecentAlert, logAlert } from "@/lib/db/alertRepo";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments } from "@/lib/semaphore";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getYahooQuotes } from "@/lib/sources/yahoo";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";
import { B3_WATCHLIST, CRIPTO_WATCHLIST, STOCKS_WATCHLIST, FII_WATCHLIST } from "@/lib/watchlist";
import { getCloses } from "@/lib/db/priceSeriesRepo";
import { getActivePriceAlerts, markPriceAlertTriggered, getHoldings } from "@/lib/db/portfolioRepo";
import { getCurrentPrice } from "@/lib/priceLookup";
import { formatPrice } from "@/lib/format";
import { getBaseUrl } from "@/lib/baseUrl";
import { getTrendingCoins } from "@/lib/sources/coingecko";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import type { AnalystTarget } from "@/lib/sources/yahooAnalyst";
import { getNegativeSectorSignals } from "@/lib/sectorSentiment";
import { getGrahamValuations } from "@/lib/valuation";

const WATCHLIST_MOVE_THRESHOLD = 5; // %

async function notify(key: string, label: string, kind: string, hoursCooldown: number): Promise<boolean> {
  if (await hasRecentAlert(key, hoursCooldown)) return false;
  await logAlert(key, label, kind);
  if (hasTelegramConfig()) {
    await sendTelegramMessage(`📡 <b>Terminal de Mercado</b>\n${label}`).catch(() => {});
  }
  return true;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json({ checked: false, reason: "DATABASE_URL não configurada" });
  }

  const sent: string[] = [];

  // 1. Inversão de fluxo B3 (semáforo verde/vermelho = 3+ pregões seguidos)
  try {
    const history = await getFlowHistory();
    const segments = buildFlowSegments(history);
    for (const seg of segments) {
      if (seg.signal === "amarelo") continue;
      const verb = seg.signal === "verde" ? "comprando" : "vendendo";
      const label = `Fluxo: ${seg.segment} está ${verb} há 3+ pregões seguidos (hoje: ${seg.dailyBRL >= 0 ? "+" : ""}${(seg.dailyBRL / 1_000_000).toFixed(0)} mi).`;
      const ok = await notify(`flow:${seg.segment}:${seg.signal}`, label, "fluxo", 96);
      if (ok) sent.push(label);
    }
  } catch {
    // fonte de fluxo indisponível nesta rodada
  }

  // 2. Z-score extremo (|z| >= 3), B3 + Cripto
  try {
    const highlights = await getZScoreHighlights();
    for (const h of highlights.filter((z) => Math.abs(z.zScore) >= 3)) {
      const label = `Z-score: ${h.symbol} com |z|=${h.zScore.toFixed(1)} (variação de ${h.changePct.toFixed(2)}% no dia) — movimento fora do padrão.`;
      const ok = await notify(`zscore:${h.symbol}`, label, "zscore", 30);
      if (ok) sent.push(label);
    }
  } catch {
    // z-score indisponível (sem backfill suficiente, por exemplo)
  }

  // 3. Watchlist: alta forte >= 5% (B3, Stocks, Cripto). Só o lado de alta —
  // quedas fortes já são cobertas pela seção 7 (Oportunidades, limiar 10%);
  // manter os dois lados aqui duplicava o mesmo movimento em dois painéis.
  try {
    const b3Symbols = B3_WATCHLIST.map((w) => `${w.symbol}.SA`);
    const stockSymbols = STOCKS_WATCHLIST.map((w) => w.symbol);
    const [b3Quotes, stockQuotes, coinMarkets] = await Promise.all([
      getYahooQuotes(b3Symbols),
      getYahooQuotes(stockSymbols),
      getTopCoinMarkets(250).catch(() => []),
    ]);

    for (const w of B3_WATCHLIST) {
      const q = b3Quotes[`${w.symbol}.SA`];
      if (q && q.changePct >= WATCHLIST_MOVE_THRESHOLD) {
        const label = `Watchlist B3: ${w.symbol} subiu ${q.changePct.toFixed(2)}% no dia.`;
        const ok = await notify(`watchlist:${w.symbol}`, label, "watchlist", 30);
        if (ok) sent.push(label);
      }
    }

    for (const w of STOCKS_WATCHLIST) {
      const q = stockQuotes[w.symbol];
      if (q && q.changePct >= WATCHLIST_MOVE_THRESHOLD) {
        const label = `Watchlist Stocks: ${w.symbol} subiu ${q.changePct.toFixed(2)}% no dia.`;
        const ok = await notify(`watchlist:${w.symbol}`, label, "watchlist", 30);
        if (ok) sent.push(label);
      }
    }

    for (const w of CRIPTO_WATCHLIST) {
      const coin = coinMarkets.find((c) => c.symbol.toLowerCase() === w.symbol.toLowerCase());
      const change = coin?.price_change_percentage_24h;
      if (typeof change === "number" && change >= WATCHLIST_MOVE_THRESHOLD) {
        const label = `Watchlist Cripto: ${w.symbol} subiu ${change.toFixed(2)}% em 24h.`;
        const ok = await notify(`watchlist:${w.symbol}`, label, "watchlist", 30);
        if (ok) sent.push(label);
      }
    }
  } catch {
    // fontes de watchlist indisponíveis nesta rodada
  }

  // 4. Alertas de preço da carteira (kill switch: dispara 1x, depois desativa)
  try {
    const priceAlerts = await getActivePriceAlerts();
    for (const alert of priceAlerts) {
      const current = await getCurrentPrice(alert.symbol, alert.assetClass).catch(() => null);
      if (!current) continue;

      const crossed =
        alert.direction === "above" ? current.price >= alert.targetPrice : current.price <= alert.targetPrice;

      if (crossed) {
        const verb = alert.direction === "above" ? "atingiu ou passou de" : "caiu para ou abaixo de";
        const label = `Alerta de preço: ${alert.label} (${alert.symbol}) ${verb} ${formatPrice(alert.targetPrice, current.currency)} — agora em ${formatPrice(current.price, current.currency)}.`;
        await markPriceAlertTriggered(alert.id);
        await logAlert(`price:${alert.id}`, label, "preco");
        if (hasTelegramConfig()) {
          await sendTelegramMessage(`📡 <b>Terminal de Mercado</b>\n${label}`).catch(() => {});
        }
        sent.push(label);
      }
    }
  } catch {
    // fontes de preço indisponíveis nesta rodada
  }

  // 4.5. Posição da carteira voltou a bater o preço médio de compra (dentro de
  // ~1.5%) — sinal de possível ponto de entrada/saída, não recomendação.
  try {
    const holdings = await getHoldings();
    for (const h of holdings) {
      if (!h.avgPrice) continue;
      const current = await getCurrentPrice(h.symbol, h.assetClass).catch(() => null);
      if (!current) continue;

      const diffPct = ((current.price - h.avgPrice) / h.avgPrice) * 100;
      if (Math.abs(diffPct) <= 1.5) {
        const label = `🎯 ${h.symbol}: preço atual (${formatPrice(current.price, current.currency)}) voltou a bater seu preço médio de compra (${formatPrice(h.avgPrice, current.currency)}).`;
        const ok = await notify(`oportunidade:preco_medio:${h.symbol}:${h.assetClass}`, label, "oportunidade", 72);
        if (ok) sent.push(label);
      }
    }
  } catch {
    // fontes de carteira indisponíveis nesta rodada
  }

  // 5. Preço-alvo dos analistas atingido/ultrapassado (watchlist Stocks + B3)
  // FII e Cripto ficam de fora aqui de propósito: Yahoo não tem cobertura de
  // analistas pra esses dois (confirmado — financialData vem vazio), não é
  // limitação nossa, é ausência real da fonte gratuita.
  try {
    const stockSymbols = STOCKS_WATCHLIST.map((w) => w.symbol);
    const b3Symbols = B3_WATCHLIST.map((w) => `${w.symbol}.SA`);
    const symbols = [...stockSymbols, ...b3Symbols].join(",");
    const res = await fetch(`${getBaseUrl()}/api/analyst-targets?symbols=${encodeURIComponent(symbols)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json.available) {
      const targets: AnalystTarget[] = json.data;
      for (const t of targets) {
        if (t.currentPrice === null || t.targetMeanPrice === null) continue;
        if (t.currentPrice >= t.targetMeanPrice) {
          const isB3 = t.symbol.endsWith(".SA");
          const symbolLabel = isB3 ? t.symbol.replace(".SA", "") : t.symbol;
          const currencyLabel = isB3 ? "R$" : "US$";
          const label = `Preço-alvo atingido: ${symbolLabel} em ${currencyLabel} ${t.currentPrice.toFixed(2)} já bateu o alvo médio dos analistas (${currencyLabel} ${t.targetMeanPrice.toFixed(2)}).`;
          // Cooldown de 30 dias — não repete todo dia enquanto o preço seguir acima do alvo.
          const ok = await notify(`price_target:${t.symbol}`, label, "preco", 24 * 30);
          if (ok) sent.push(label);
        }
      }
    }
  } catch {
    // fonte de preço-alvo indisponível nesta rodada
  }

  // 6. Ativo da watchlist cripto entrou no Trending da CoinGecko — sinal de
  // que o mercado começou a prestar atenção nele agora.
  try {
    const dbWatchlist = await getWatchlist("cripto").catch(() => []);
    const watchlistSymbols = new Set([
      ...CRIPTO_WATCHLIST.map((w) => w.symbol.toUpperCase()),
      ...dbWatchlist.map((w) => w.symbol.toUpperCase()),
    ]);
    const trending = await getTrendingCoins();
    for (const coin of trending) {
      if (!watchlistSymbols.has(coin.symbol)) continue;
      const label = `🔥 ${coin.symbol} (${coin.name}) entrou no Trending da CoinGecko — mercado prestando atenção nele agora.`;
      // Cooldown de 12h — evita repetir enquanto continuar em alta na lista.
      const ok = await notify(`trending:${coin.symbol}`, label, "watchlist", 12);
      if (ok) sent.push(label);
    }
  } catch {
    // fonte de trending indisponível nesta rodada
  }

  // 7. Oportunidades: queda forte (>=10% no dia, qualquer classe), cripto
  // capitulando na semana (>=15% em 7 dias) e FII sem próximo dividendo
  // anunciado que também caiu no dia — sinais de "vale olhar mais de perto",
  // não recomendação.
  try {
    const dbFii = await getWatchlist("fii").catch(() => []);
    const fiiWatchlist = [...FII_WATCHLIST, ...dbFii.filter((w) => !FII_WATCHLIST.some((f) => f.symbol === w.symbol))];
    const fiiSymbols = fiiWatchlist.map((w) => `${w.symbol}.SA`);
    const fiiQuotes = await getYahooQuotes(fiiSymbols);

    const dbB3 = await getWatchlist("b3").catch(() => []);
    const b3All = [...B3_WATCHLIST, ...dbB3.filter((w) => !B3_WATCHLIST.some((f) => f.symbol === w.symbol))];
    const b3Quotes = await getYahooQuotes(b3All.map((w) => `${w.symbol}.SA`));

    const dbStocks = await getWatchlist("stocks").catch(() => []);
    const stocksAll = [...STOCKS_WATCHLIST, ...dbStocks.filter((w) => !STOCKS_WATCHLIST.some((f) => f.symbol === w.symbol))];
    const stockQuotesOpp = await getYahooQuotes(stocksAll.map((w) => w.symbol));

    const coinMarketsOpp = await getTopCoinMarkets(250).catch(() => []);
    const dbCripto = await getWatchlist("cripto").catch(() => []);
    const criptoAll = [...CRIPTO_WATCHLIST, ...dbCripto.filter((w) => !CRIPTO_WATCHLIST.some((f) => f.symbol === w.symbol))];

    const DROP_THRESHOLD = 10; // %

    for (const w of b3All) {
      const q = b3Quotes[`${w.symbol}.SA`];
      if (q && q.changePct <= -DROP_THRESHOLD) {
        const label = `📉 Queda forte: ${w.symbol} caiu ${Math.abs(q.changePct).toFixed(2)}% no dia — pode valer a pena olhar o motivo.`;
        const ok = await notify(`oportunidade:queda:${w.symbol}`, label, "oportunidade", 30);
        if (ok) sent.push(label);
      }
    }

    for (const w of stocksAll) {
      const q = stockQuotesOpp[w.symbol];
      if (q && q.changePct <= -DROP_THRESHOLD) {
        const label = `📉 Queda forte: ${w.symbol} caiu ${Math.abs(q.changePct).toFixed(2)}% no dia — pode valer a pena olhar o motivo.`;
        const ok = await notify(`oportunidade:queda:${w.symbol}`, label, "oportunidade", 30);
        if (ok) sent.push(label);
      }
    }

    for (const w of fiiWatchlist) {
      const q = fiiQuotes[`${w.symbol}.SA`];
      if (q && q.changePct <= -DROP_THRESHOLD) {
        const label = `📉 Queda forte: ${w.symbol} caiu ${Math.abs(q.changePct).toFixed(2)}% no dia — pode valer a pena olhar o motivo.`;
        const ok = await notify(`oportunidade:queda:${w.symbol}`, label, "oportunidade", 30);
        if (ok) sent.push(label);
      }
    }

    for (const w of criptoAll) {
      const coin = coinMarketsOpp.find((c) => c.symbol.toLowerCase() === w.symbol.toLowerCase());
      const change = coin?.price_change_percentage_24h;
      if (typeof change === "number" && change <= -DROP_THRESHOLD) {
        const label = `📉 Queda forte: ${w.symbol} caiu ${Math.abs(change).toFixed(2)}% em 24h — pode valer a pena olhar o motivo.`;
        const ok = await notify(`oportunidade:queda:${w.symbol}`, label, "oportunidade", 30);
        if (ok) sent.push(label);
      }
    }

    // Cripto capitulando na semana: usa histórico salvo (price_series), não a
    // fonte ao vivo — compara o fechamento mais antigo com o mais recente
    // dentro dos últimos 7 pregões coletados.
    for (const w of criptoAll) {
      try {
        const closes = await getCloses(w.symbol, "cripto", 7);
        if (closes.length < 5) continue;
        const first = closes[0].closePrice;
        const last = closes[closes.length - 1].closePrice;
        const weekChangePct = ((last - first) / first) * 100;
        if (weekChangePct <= -15) {
          const label = `📉 ${w.symbol} caiu ${Math.abs(weekChangePct).toFixed(1)}% nos últimos ${closes.length} pregões — queda persistente, não só um dia ruim.`;
          const ok = await notify(`oportunidade:semana:${w.symbol}`, label, "oportunidade", 48);
          if (ok) sent.push(label);
        }
      } catch {
        // histórico insuficiente pra esse ativo ainda
      }
    }

    // FII sem próxima data de dividendo anunciada (via Yahoo) + caiu no dia —
    // sinal de atenção, não confirmação de corte de provento (a fonte não
    // declara isso diretamente, só a ausência de uma data futura conhecida).
    for (const w of fiiWatchlist) {
      const q = fiiQuotes[`${w.symbol}.SA`];
      if (!q || q.changePct > -3) continue;
      try {
        const res = await fetch(`${getBaseUrl()}/api/ticker-detail?symbol=${encodeURIComponent(`${w.symbol}.SA`)}`, {
          next: { revalidate: 120 },
        });
        const json = await res.json();
        const exDividendDate = json?.data?.exDividendDate as string | null | undefined;
        const today = new Date().toISOString().slice(0, 10);
        if (json.available && (!exDividendDate || exDividendDate < today)) {
          const label = `⚠️ ${w.symbol}: sem próxima data de dividendo anunciada (Yahoo) e caiu ${Math.abs(q.changePct).toFixed(2)}% no dia — vale checar se cortou provento.`;
          const ok = await notify(`oportunidade:fii_div:${w.symbol}`, label, "oportunidade", 48);
          if (ok) sent.push(label);
        }
      } catch {
        // fonte de dividendo indisponível pra esse FII nesta rodada
      }
    }
  } catch {
    // fontes de oportunidades indisponíveis nesta rodada
  }

  // 8. Sentimento setorial (heurística por palavra-chave, não é IA de verdade):
  // setor com 3+ manchetes de tom negativo na semana — sinal de "vale olhar
  // exposição do setor", não confirmação de nada.
  try {
    const signals = await getNegativeSectorSignals(7);
    for (const s of signals.filter((x) => x.count >= 3)) {
      const label = `📊 Setor ${s.sector}: ${s.count} notícias com tom negativo nos últimos 7 dias (ex.: "${s.sampleTitles[0]}") — heurística por palavra-chave, vale conferir exposição do setor na carteira.`;
      const ok = await notify(`oportunidade:setor:${s.sector}`, label, "oportunidade", 168);
      if (ok) sent.push(label);
    }
  } catch {
    // fonte de notícias indisponível nesta rodada
  }

  // 9. Valor justo de Graham cruzado (margem >= 20%, ações B3 da watchlist) —
  // mesmo cálculo já usado na aba Oportunidades. Cooldown de 30 dias: é
  // fundamento (LPA/VPA), não muda todo dia, não faz sentido repetir com
  // frequência.
  try {
    const dbB3ForGraham = await getWatchlist("b3").catch(() => []);
    const b3ForGraham = [...B3_WATCHLIST, ...dbB3ForGraham.filter((w) => !B3_WATCHLIST.some((f) => f.symbol === w.symbol))];
    const graham = await getGrahamValuations(b3ForGraham);
    for (const g of graham.filter((x) => x.marginOfSafetyPct >= 20)) {
      const label = `📐 ${g.symbol}: preço (R$ ${g.price.toFixed(2)}) está ${g.marginOfSafetyPct.toFixed(0)}% abaixo do valor justo de Graham (R$ ${g.fairValue.toFixed(2)}) — vale olhar na aba Oportunidades (fórmula tem limitações conhecidas, não é recomendação).`;
      const ok = await notify(`oportunidade:graham:${g.symbol}`, label, "oportunidade", 24 * 30);
      if (ok) sent.push(label);
    }
  } catch {
    // fonte de fundamentos indisponível nesta rodada
  }

  return NextResponse.json({ checked: true, alertsSent: sent.length, sent });
}
