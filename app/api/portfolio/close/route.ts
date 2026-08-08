import { NextResponse } from "next/server";
import { closeHolding, getClosedPositions } from "@/lib/db/portfolioRepo";

export async function GET() {
  try {
    const data = await getClosedPositions();
    return NextResponse.json({ available: true, data });
  } catch (err) {
    return NextResponse.json({ available: false, data: [], error: err instanceof Error ? err.message : "Falha" });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { id, sellPrice } = body;
  if (!id || !sellPrice) {
    return NextResponse.json({ error: "Campos obrigatórios: id, sellPrice" }, { status: 400 });
  }
  await closeHolding(Number(id), Number(sellPrice));
  return NextResponse.json({ ok: true });
}
