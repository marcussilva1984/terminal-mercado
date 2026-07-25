import { NextResponse } from "next/server";
import { getZScoreHighlights } from "@/lib/zscoreService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass");

  try {
    const data = await getZScoreHighlights(assetClass === "b3" || assetClass === "cripto" ? assetClass : undefined);
    return NextResponse.json({ available: true, updatedAt: new Date().toISOString(), data });
  } catch (err) {
    return NextResponse.json({
      available: false,
      updatedAt: new Date().toISOString(),
      data: [],
      error: err instanceof Error ? err.message : "Falha ao calcular z-score",
    });
  }
}
