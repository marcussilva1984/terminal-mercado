import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { hasDatabase } from "@/lib/db/client";
import { setDerivativesCache } from "@/lib/db/derivativesCacheRepo";
import { getDerivativesSnapshot } from "@/lib/sources/cryptoDerivatives";

export const maxDuration = 60;

// Busca isolada (fora da renderização da página Cripto, que já faz várias
// chamadas ao CoinGecko de uma vez e leva 429) e grava no banco.
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ saved: false, reason: "DATABASE_URL não configurada" });
  }
  try {
    const { data } = await getDerivativesSnapshot();
    await setDerivativesCache(data);
    return NextResponse.json({ saved: true, count: data.length });
  } catch (e) {
    console.error("Derivativos cripto: falha ao atualizar cache:", e);
    return NextResponse.json({ saved: false, error: String(e) }, { status: 502 });
  }
}
