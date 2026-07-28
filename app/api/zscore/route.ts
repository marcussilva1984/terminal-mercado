import { NextResponse } from "next/server";
import { getZScoreHighlights } from "@/lib/zscoreService";
import type { AssetClass } from "@/lib/types";

const VALID_CLASSES: AssetClass[] = ["b3", "cripto", "fii", "stocks"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass");

  try {
    const data = await getZScoreHighlights(
      VALID_CLASSES.includes(assetClass as AssetClass) ? (assetClass as AssetClass) : undefined
    );
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
