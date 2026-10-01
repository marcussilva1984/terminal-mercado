import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getForexEntries, addForexEntry, deleteForexEntry } from "@/lib/db/forexBrokerRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ available: false, error: "DATABASE_URL não configurada" });
  try {
    const data = await getForexEntries();
    return NextResponse.json({ available: true, data });
  } catch (e) {
    return NextResponse.json({ available: false, error: String(e) });
  }
}

export async function POST(req: Request) {
  if (!hasDatabase()) return NextResponse.json({ ok: false, error: "DATABASE_URL não configurada" }, { status: 503 });
  const { broker, balance_usd, deposit_usd = 0, withdrawal_usd = 0, recorded_at } = await req.json();
  if (!broker || balance_usd == null || !recorded_at) {
    return NextResponse.json({ ok: false, error: "broker, balance_usd e recorded_at são obrigatórios" }, { status: 400 });
  }
  await addForexEntry(broker, parseFloat(balance_usd), parseFloat(deposit_usd), parseFloat(withdrawal_usd), recorded_at);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!hasDatabase()) return NextResponse.json({ ok: false }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  await deleteForexEntry(id);
  return NextResponse.json({ ok: true });
}
