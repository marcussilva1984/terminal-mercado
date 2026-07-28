import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getWatchlist, addWatchlistItem, removeWatchlistItem, seedWatchlistIfEmpty } from "@/lib/db/watchlistRepo";
import { B3_WATCHLIST, CRIPTO_WATCHLIST } from "@/lib/watchlist";
import { getCurrentPrice } from "@/lib/priceLookup";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ available: false, data: [], error: "DATABASE_URL não configurada" });
  }

  try {
    await seedWatchlistIfEmpty([
      ...B3_WATCHLIST.map((w) => ({ ...w, assetClass: "b3" })),
      ...CRIPTO_WATCHLIST.map((w) => ({ ...w, assetClass: "cripto" })),
    ]);
    const items = await getWatchlist();
    const withPrices = await Promise.all(
      items.map(async (item) => {
        const current = await getCurrentPrice(item.symbol, item.assetClass).catch(() => null);
        return { ...item, price: current?.price ?? null, changePct: current?.changePct ?? null, currency: current?.currency ?? null };
      })
    );
    return NextResponse.json({ available: true, data: withPrices });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao carregar watchlist",
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, assetClass, label } = body;

  if (!symbol || !assetClass) {
    return NextResponse.json({ error: "Campos obrigatórios: symbol, assetClass" }, { status: 400 });
  }
  if (assetClass !== "b3" && assetClass !== "cripto") {
    return NextResponse.json({ error: "assetClass deve ser 'b3' ou 'cripto'" }, { status: 400 });
  }

  await addWatchlistItem({
    symbol: String(symbol).toUpperCase(),
    assetClass,
    label: label || symbol,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await removeWatchlistItem(id);
  return NextResponse.json({ ok: true });
}
