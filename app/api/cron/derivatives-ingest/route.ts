import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { setDerivativesCache } from "@/lib/db/derivativesCacheRepo";
import type { DerivativeSnapshot } from "@/lib/sources/binanceFutures";

// Endpoint é rápido normalmente, mas a escrita no banco pode enfileirar sob
// carga — mesma margem de segurança dos outros crons.
export const maxDuration = 60;

// Recebe o snapshot de derivativos já buscado por um agente EXTERNO (GitHub
// Actions) e só grava no banco — não faz nenhuma chamada à Binance aqui.
// Existe porque chamadas server-to-server dentro da própria Vercel para a
// Binance falham sempre (parece bloqueio de IP), mesmo as mesmas rotas
// funcionando perfeitamente quando acessadas de fora.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json({ saved: false, reason: "DATABASE_URL não configurada" });
  }

  const body = await request.json();
  const data: DerivativeSnapshot[] = body?.data ?? [];
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ saved: false, reason: "payload vazio ou inválido" }, { status: 400 });
  }

  await setDerivativesCache(data);
  return NextResponse.json({ saved: true, count: data.length });
}
