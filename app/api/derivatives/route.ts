import { NextResponse } from "next/server";
import { getDerivativesSnapshot } from "@/lib/sources/binanceFutures";

// Edge Runtime: a Binance bloqueia por IP de datacenter dos EUA, e a região
// padrão das funções serverless da Vercel (iad1, AWS us-east) cai nesse bloqueio.
// O runtime de Edge da Vercel usa uma rede diferente que não é bloqueada.
export const runtime = "edge";

export async function GET() {
  try {
    const data = await getDerivativesSnapshot();
    return NextResponse.json({ available: true, data });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao carregar derivativos",
    });
  }
}
