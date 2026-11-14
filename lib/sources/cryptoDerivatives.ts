// Perpétuos da Binance Futures via CoinGecko (sem chave). A Binance recusa
// chamadas vindas da Vercel, o CoinGecko não — mesma fonte de dado, sem job
// externo. Limitação: o CoinGecko não traz long/short ratio nem histórico,
// só a leitura atual de funding, open interest e basis.
const URL = "https://api.coingecko.com/api/v3/derivatives/exchanges/binance_futures?include_tickers=unexpired";

export const DERIVATIVES_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "SUIUSDT", "LINKUSDT"];

export interface DerivativeSnapshot {
  symbol: string;
  fundingRatePct: number; // por período de 8h; positivo = longs pagam shorts
  openInterestUsd: number;
  basisPct: number; // prêmio do perpétuo sobre o índice spot
  change24hPct: number;
  volume24hUsd: number;
}

interface Ticker {
  symbol: string;
  base: string;
  contract_type: string;
  funding_rate: number;
  open_interest_usd: number;
  index_basis_percentage: number;
  h24_percentage_change: number;
  converted_volume?: { usd?: string };
}

export async function getDerivativesSnapshot(): Promise<{ data: DerivativeSnapshot[]; fetchedAt: string }> {
  const res = await fetch(URL, { next: { revalidate: 5 * 60 }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`CoinGecko derivativos respondeu ${res.status}`);
  const json = await res.json();
  const tickers: Ticker[] = json?.tickers ?? [];

  const data = DERIVATIVES_SYMBOLS.flatMap((sym) => {
    const t = tickers.find((x) => x.symbol === sym && x.contract_type === "perpetual");
    if (!t) return [];
    return [
      {
        symbol: t.base,
        fundingRatePct: Number(t.funding_rate) || 0,
        openInterestUsd: Number(t.open_interest_usd) || 0,
        basisPct: Number(t.index_basis_percentage) || 0,
        change24hPct: Number(t.h24_percentage_change) || 0,
        volume24hUsd: Number(t.converted_volume?.usd) || 0,
      },
    ];
  });

  if (data.length === 0) throw new Error("CoinGecko não devolveu nenhum perpétuo da Binance");
  return { data, fetchedAt: new Date().toISOString() };
}
