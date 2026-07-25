import { NextResponse } from "next/server";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments } from "@/lib/semaphore";

export async function GET() {
  try {
    const history = await getFlowHistory();
    const segments = buildFlowSegments(history);
    return NextResponse.json({
      available: true,
      updatedAt: new Date().toISOString(),
      lastTradingDay: history[history.length - 1]?.date,
      data: segments,
    });
  } catch (err) {
    return NextResponse.json({
      available: false,
      updatedAt: new Date().toISOString(),
      data: [],
      error: err instanceof Error ? err.message : "Falha ao buscar fluxo B3",
    });
  }
}
