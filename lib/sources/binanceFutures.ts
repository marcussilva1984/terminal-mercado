// Dados de derivativos (perpétuos USD-M) via API pública da Binance Futures —
// sem chave, sem custo. Funding rate, open interest e long/short ratio são os
// proxies de mercado mais usados para "alavancagem"/pressão comprada-vendida em
// cripto, já que não existe short interest centralizado como em ações.

const FAPI_BASE = "https://fapi.binance.com";

// Perpétuos mais líquidos — mantém a lista curta para não estourar o tempo da
// function serverless (cada símbolo dispara 3 requests em paralelo).
export const DERIVATIVES_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "SUIUSDT",
  "LINKUSDT",
] as const;

export interface DerivativeSnapshot {
  symbol: string;
  fundingRatePct: number; // taxa atual (%), positiva = longs pagam shorts (mercado "comprado demais")
  fundingRateChange1d: number;
  fundingRateChange1w: number;
  openInterestUsd: number;
  oiChange1dPct: number;
  oiChange1wPct: number;
  oiChange1mPct: number;
  longShortRatio: number; // >1 = mais contas compradas, <1 = mais contas vendidas
  longPct: number;
  shortPct: number;
  lsChange1dPct: number;
  lsChange1wPct: number;
}

async function getJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 5 * 60 }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Binance Futures respondeu ${res.status} para ${url}`);
  return res.json();
}

async function fetchSymbolSnapshot(symbol: string): Promise<DerivativeSnapshot | null> {
  try {
    const [premium, fundingHist, oiHist, lsHist] = await Promise.all([
      getJson(`${FAPI_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`),
      getJson(`${FAPI_BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=90`), // ~30 dias (3/dia)
      getJson(`${FAPI_BASE}/futures/data/openInterestHist?symbol=${symbol}&period=1d&limit=31`),
      getJson(`${FAPI_BASE}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1d&limit=8`),
    ]);

    const currentFunding = parseFloat(premium.lastFundingRate) * 100;
    const funding1dAgo = fundingHist.length >= 4 ? parseFloat(fundingHist[fundingHist.length - 4].fundingRate) * 100 : currentFunding;
    const funding1wAgo = fundingHist.length >= 22 ? parseFloat(fundingHist[fundingHist.length - 22].fundingRate) * 100 : currentFunding;

    const oiNow = oiHist.length > 0 ? parseFloat(oiHist[oiHist.length - 1].sumOpenInterestValue) : 0;
    const oi1dAgo = oiHist.length >= 2 ? parseFloat(oiHist[oiHist.length - 2].sumOpenInterestValue) : oiNow;
    const oi1wAgo = oiHist.length >= 8 ? parseFloat(oiHist[oiHist.length - 8].sumOpenInterestValue) : oiNow;
    const oi1mAgo = oiHist.length >= 20 ? parseFloat(oiHist[0].sumOpenInterestValue) : oiNow;

    const lsNow = lsHist.length > 0 ? lsHist[lsHist.length - 1] : null;
    const ls1dAgo = lsHist.length >= 2 ? lsHist[lsHist.length - 2] : lsNow;
    const ls1wAgo = lsHist.length >= 7 ? lsHist[0] : lsNow;

    const ratioNow = lsNow ? parseFloat(lsNow.longShortRatio) : 1;
    const ratio1dAgo = ls1dAgo ? parseFloat(ls1dAgo.longShortRatio) : ratioNow;
    const ratio1wAgo = ls1wAgo ? parseFloat(ls1wAgo.longShortRatio) : ratioNow;

    return {
      symbol: symbol.replace("USDT", ""),
      fundingRatePct: currentFunding,
      fundingRateChange1d: currentFunding - funding1dAgo,
      fundingRateChange1w: currentFunding - funding1wAgo,
      openInterestUsd: oiNow,
      oiChange1dPct: oi1dAgo ? ((oiNow - oi1dAgo) / oi1dAgo) * 100 : 0,
      oiChange1wPct: oi1wAgo ? ((oiNow - oi1wAgo) / oi1wAgo) * 100 : 0,
      oiChange1mPct: oi1mAgo ? ((oiNow - oi1mAgo) / oi1mAgo) * 100 : 0,
      longShortRatio: ratioNow,
      longPct: lsNow ? parseFloat(lsNow.longAccount) * 100 : 50,
      shortPct: lsNow ? parseFloat(lsNow.shortAccount) * 100 : 50,
      lsChange1dPct: ratio1dAgo ? ((ratioNow - ratio1dAgo) / ratio1dAgo) * 100 : 0,
      lsChange1wPct: ratio1wAgo ? ((ratioNow - ratio1wAgo) / ratio1wAgo) * 100 : 0,
    };
  } catch {
    return null;
  }
}

// Cada símbolo dispara 4 requests em paralelo pra Binance; buscar os 8 símbolos
// de uma vez só dispararia 32 conexões simultâneas da mesma function — sob
// carga isso batia rate-limit/timeout da Binance e derrubava TODOS os
// símbolos de uma vez (silenciosamente, sem erro visível). Processa em lotes
// menores pra reduzir o pico de conexões simultâneas.
const BATCH_SIZE = 3;

export async function getDerivativesSnapshot(): Promise<DerivativeSnapshot[]> {
  const results: (DerivativeSnapshot | null)[] = [];
  for (let i = 0; i < DERIVATIVES_SYMBOLS.length; i += BATCH_SIZE) {
    const batch = DERIVATIVES_SYMBOLS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchSymbolSnapshot));
    results.push(...batchResults);
  }
  return results.filter((r): r is DerivativeSnapshot => r !== null);
}
