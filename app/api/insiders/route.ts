import { NextResponse } from "next/server";
import { getInsiderTransactionsForWatchlist } from "@/lib/sources/secInsiders";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") ?? "").split(",").filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ available: false, data: [], error: "parâmetro symbols obrigatório" });
  }

  try {
    const data = await getInsiderTransactionsForWatchlist(symbols);
    return NextResponse.json({ available: true, data });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao carregar insiders",
    });
  }
}
