import { NextResponse } from "next/server";
import { getDerivativesSnapshot } from "@/lib/sources/binanceFutures";

// Edge Runtime: a Binance bloqueia por IP de datacenter dos EUA, e a região
// padrão das funções serverless da Vercel (iad1, AWS us-east) cai nesse bloqueio.
// O runtime de Edge da Vercel usa uma rede diferente que não é bloqueada.
export const runtime = "edge";

export async function GET() {
  // Sem isso, respostas de erro (200 com available:false) podiam ficar presas
  // no cache de borda da Vercel por POP/região — quem batesse num POP com uma
  // falha cacheada via a mesma resposta repetidamente, mesmo com a fonte já
  // tendo voltado a funcionar (explica o padrão "sempre falha do GitHub
  // Actions, sempre funciona de outro lugar" que vimos nos testes).
  const headers = { "Cache-Control": "no-store, max-age=0" };

  try {
    const data = await getDerivativesSnapshot();
    // getDerivativesSnapshot descarta falhas por símbolo silenciosamente
    // (retorna null pra cada um) — se TODOS falharam, isso não é "sem dado",
    // é a fonte fora do ar; trata como erro pra aparecer certo na UI.
    if (data.length === 0) throw new Error("Binance Futures indisponível (todos os pares falharam)");
    return NextResponse.json({ available: true, data }, { headers });
  } catch (err) {
    return NextResponse.json(
      {
        available: false,
        data: [],
        error: err instanceof Error ? err.message : "Falha ao carregar derivativos",
      },
      { headers }
    );
  }
}
