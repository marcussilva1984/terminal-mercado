import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { getForexEntries, addForexEntry, deleteForexEntry, updateForexEntry } from "@/lib/db/forexBrokerRepo";

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
  const balanceUsd = parseFloat(balance_usd);
  const depositUsd = parseFloat(deposit_usd) || 0;
  const withdrawalUsd = parseFloat(withdrawal_usd) || 0;
  await addForexEntry(broker, balanceUsd, depositUsd, withdrawalUsd, recorded_at);

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!hasDatabase()) return NextResponse.json({ ok: false, error: "DATABASE_URL não configurada" }, { status: 503 });
  const { id, balance_usd, deposit_usd = 0, withdrawal_usd = 0, recorded_at } = await req.json();
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || balance_usd == null || !recorded_at) {
    return NextResponse.json({ ok: false, error: "id, balance_usd e recorded_at são obrigatórios" }, { status: 400 });
  }
  await updateForexEntry(idNum, {
    balanceUsd: parseFloat(balance_usd),
    depositUsd: parseFloat(deposit_usd) || 0,
    withdrawalUsd: parseFloat(withdrawal_usd) || 0,
    recordedAt: recorded_at,
  });
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
