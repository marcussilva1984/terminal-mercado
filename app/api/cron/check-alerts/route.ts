import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { hasRecentAlert, logAlert } from "@/lib/db/alertRepo";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments } from "@/lib/semaphore";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getYahooQuotes } from "@/lib/sources/yahoo";
import { getTopCoinMarkets } from "@/lib/sources/coingecko";
import { sendTelegramMessage, hasTelegramConfig } from "@/lib/sources/telegram";
import { B3_WATCHLIST, CRIPTO_WATCHLIST, STOCKS_WATCHLIST } from "@/lib/watchlist";
import { getActivePriceAlerts, markPriceAlertTriggered } from "@/lib/db/portfolioRepo";
import { getCurrentPrice } from "@/lib/priceLookup";
import { formatPrice } from "@/lib/format";

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
      const ok = await notify(`zscore:${h.symbol}`, label, "zscore", 20);
      if (ok) sent.push(label);
    }
  } catch {
    // z-score indisponível (sem backfill suficiente, por exemplo)
  }

  // 3. Watchlist: variação diária >= 5% (B3, Stocks, Cripto)
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
      if (q && Math.abs(q.changePct) >= WATCHLIST_MOVE_THRESHOLD) {
        const label = `Watchlist B3: ${w.symbol} ${q.changePct >= 0 ? "subiu" : "caiu"} ${Math.abs(q.changePct).toFixed(2)}% no dia.`;
        const ok = await notify(`watchlist:${w.symbol}`, label, "watchlist", 20);
        if (ok) sent.push(label);
      }
    }

    for (const w of STOCKS_WATCHLIST) {
      const q = stockQuotes[w.symbol];
      if (q && Math.abs(q.changePct) >= WATCHLIST_MOVE_THRESHOLD) {
        const label = `Watchlist Stocks: ${w.symbol} ${q.changePct >= 0 ? "subiu" : "caiu"} ${Math.abs(q.changePct).toFixed(2)}% no dia.`;
        const ok = await notify(`watchlist:${w.symbol}`, label, "watchlist", 20);
        if (ok) sent.push(label);
      }
    }

    for (const w of CRIPTO_WATCHLIST) {
      const coin = coinMarkets.find((c) => c.symbol.toLowerCase() === w.symbol.toLowerCase());
      const change = coin?.price_change_percentage_24h;
      if (typeof change === "number" && Math.abs(change) >= WATCHLIST_MOVE_THRESHOLD) {
        const label = `Watchlist Cripto: ${w.symbol} ${change >= 0 ? "subiu" : "caiu"} ${Math.abs(change).toFixed(2)}% em 24h.`;
        const ok = await notify(`watchlist:${w.symbol}`, label, "watchlist", 20);
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

  return NextResponse.json({ checked: true, alertsSent: sent.length, sent });
}
