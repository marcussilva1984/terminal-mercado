import { NextResponse } from "next/server";
import { getHoldings, addHolding, removeHolding, updateHoldingNotes } from "@/lib/db/portfolioRepo";
import { getCurrentPrice } from "@/lib/priceLookup";

export async function GET() {
  try {
    const holdings = await getHoldings();
    const withPrices = await Promise.all(
      holdings.map(async (h) => {
        const current = await getCurrentPrice(h.symbol, h.assetClass).catch(() => null);
        const currentPrice = current?.price ?? null;
        const currentValue = currentPrice !== null ? currentPrice * h.quantity : null;
        const costValue = h.avgPrice * h.quantity;
        const pnl = currentValue !== null ? currentValue - costValue : null;
        const pnlPct = currentValue !== null && costValue > 0 ? (pnl! / costValue) * 100 : null;

        return {
          id: h.id,
          symbol: h.symbol,
          assetClass: h.assetClass,
          label: h.label,
          quantity: h.quantity,
          avgPrice: h.avgPrice,
          notes: h.notes,
          currentPrice,
          currentValue,
          pnl,
          pnlPct,
          currency: current?.currency ?? null,
        };
      })
    );

    return NextResponse.json({ available: true, data: withPrices });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao carregar carteira",
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, assetClass, label, quantity, avgPrice, notes } = body;

  if (!symbol || !assetClass || !quantity || !avgPrice) {
    return NextResponse.json({ error: "Campos obrigatórios: symbol, assetClass, quantity, avgPrice" }, { status: 400 });
  }

  await addHolding({
    symbol: String(symbol).toUpperCase(),
    assetClass,
    label: label || symbol,
    quantity: Number(quantity),
    avgPrice: Number(avgPrice),
    notes: notes ? String(notes) : undefined,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, notes } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await updateHoldingNotes(Number(id), String(notes ?? ""));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await removeHolding(id);
  return NextResponse.json({ ok: true });
}
