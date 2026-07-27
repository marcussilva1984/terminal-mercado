import { NextResponse } from "next/server";
import { getAnalystTargets } from "@/lib/sources/yahooAnalyst";

// Edge Runtime: mesmo problema da Binance — o crumb/cookie do Yahoo falha a
// partir da região serverless padrão da Vercel (iad1, AWS us-east). Edge usa
// uma rede diferente.
export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") ?? "").split(",").filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ available: false, data: [], error: "parâmetro symbols obrigatório" });
  }

  try {
    const data = await getAnalystTargets(symbols);
    return NextResponse.json({ available: true, data });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao carregar preço-alvo",
    });
  }
}
