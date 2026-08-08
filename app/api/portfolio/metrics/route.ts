import { NextResponse } from "next/server";
import { getHoldings } from "@/lib/db/portfolioRepo";
import { getCurrentPrice } from "@/lib/priceLookup";
import { getMaxDrawdown, getPortfolioSharpe, getDividendsReceived } from "@/lib/portfolioMetrics";

export async function GET() {
  try {
    const holdings = await getHoldings();

    const withValue = await Promise.all(
      holdings.map(async (h) => {
        const current = await getCurrentPrice(h.symbol, h.assetClass).catch(() => null);
        const currentValue = current ? current.price * h.quantity : h.avgPrice * h.quantity;
        return { symbol: h.symbol, assetClass: h.assetClass, currentValue };
      })
    );
    const totalValue = withValue.reduce((s, h) => s + h.currentValue, 0);

    const drawdowns = await Promise.all(
      holdings.map(async (h) => ({ symbol: h.symbol, drawdown: await getMaxDrawdown(h.symbol, h.assetClass).catch(() => null) }))
    );

    const sharpe =
      totalValue > 0
        ? await getPortfolioSharpe(
            withValue.map((h) => ({ symbol: h.symbol, assetClass: h.assetClass, weight: h.currentValue / totalValue }))
          ).catch(() => null)
        : null;

    const dividends = await getDividendsReceived(
      holdings.map((h) => ({
        symbol: h.symbol,
        assetClass: h.assetClass,
        quantity: h.quantity,
        sinceDate: h.createdAt.toISOString().slice(0, 10),
      }))
    ).catch(() => []);

    return NextResponse.json({
      available: true,
      drawdowns: drawdowns.filter((d) => d.drawdown !== null),
      sharpe,
      dividends,
    });
  } catch (err) {
    return NextResponse.json({
      available: false,
      error: err instanceof Error ? err.message : "Falha ao calcular métricas",
    });
  }
}
