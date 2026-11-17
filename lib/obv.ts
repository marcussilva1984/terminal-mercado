import type { ClosePoint } from "@/lib/db/priceSeriesRepo";

export interface ObvResult {
  obv: number;         // valor atual
  obvTrend: "alta" | "baixa" | "neutro";  // direção das últimas 5 leituras
  obvDivergence: boolean; // preço subiu mas OBV caiu (ou vice-versa) nas últimas 5 leituras
}

export function computeObv(candles: ClosePoint[]): ObvResult | null {
  if (candles.length < 2) return null;

  // Verifica se temos volume
  const hasVolume = candles.some((c) => c.volume && c.volume > 0);
  if (!hasVolume) return null;

  const obvValues: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const prev = obvValues[obvValues.length - 1];
    const vol = candles[i].volume ?? 0;
    if (candles[i].closePrice > candles[i - 1].closePrice) {
      obvValues.push(prev + vol);
    } else if (candles[i].closePrice < candles[i - 1].closePrice) {
      obvValues.push(prev - vol);
    } else {
      obvValues.push(prev);
    }
  }

  const lookback = Math.min(5, obvValues.length);
  const recentObv = obvValues.slice(-lookback);
  const recentPrice = candles.slice(-lookback).map((c) => c.closePrice);

  const obvStart = recentObv[0];
  const obvEnd = recentObv[recentObv.length - 1];
  const priceStart = recentPrice[0];
  const priceEnd = recentPrice[recentPrice.length - 1];

  const obvTrend: ObvResult["obvTrend"] =
    obvEnd > obvStart * 1.001 ? "alta" : obvEnd < obvStart * 0.999 ? "baixa" : "neutro";

  // Divergência: preço sobe mas OBV cai (bearish) ou preço cai mas OBV sobe (bullish)
  const priceMoved = Math.abs(priceEnd - priceStart) / priceStart > 0.005;
  const obvDivergence =
    priceMoved &&
    ((priceEnd > priceStart && obvEnd < obvStart) || (priceEnd < priceStart && obvEnd > obvStart));

  return { obv: obvEnd, obvTrend, obvDivergence };
}

export function obvSignal(result: ObvResult | null): "confirma" | "diverge" | null {
  if (!result) return null;
  if (result.obvDivergence) return "diverge";
  if (result.obvTrend !== "neutro") return "confirma";
  return null;
}
