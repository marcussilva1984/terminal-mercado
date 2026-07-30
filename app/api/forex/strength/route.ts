import { NextResponse } from "next/server";
import { getCurrencyStrength, type StrengthPeriod } from "@/lib/forexService";

const VALID_PERIODS: StrengthPeriod[] = ["1d", "1wk", "1mo"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get("period");
  const period = (VALID_PERIODS.includes(periodParam as StrengthPeriod) ? periodParam : "1d") as StrengthPeriod;

  try {
    const data = await getCurrencyStrength(period);
    return NextResponse.json({ available: true, data });
  } catch (err) {
    return NextResponse.json({
      available: false,
      data: [],
      error: err instanceof Error ? err.message : "Falha ao calcular força das moedas",
    });
  }
}
