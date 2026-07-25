import { NextResponse } from "next/server";
import { getActivePriceAlerts, addPriceAlert, removePriceAlert } from "@/lib/db/portfolioRepo";

export async function GET() {
  try {
    const alerts = await getActivePriceAlerts();
    return NextResponse.json({ available: true, data: alerts });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao carregar alertas de preço",
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, assetClass, label, direction, targetPrice } = body;

  if (!symbol || !assetClass || !direction || !targetPrice) {
    return NextResponse.json(
      { error: "Campos obrigatórios: symbol, assetClass, direction, targetPrice" },
      { status: 400 }
    );
  }

  await addPriceAlert({
    symbol: String(symbol).toUpperCase(),
    assetClass,
    label: label || symbol,
    direction,
    targetPrice: Number(targetPrice),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await removePriceAlert(id);
  return NextResponse.json({ ok: true });
}
