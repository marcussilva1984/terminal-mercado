export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
}

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Sem API key: Demo plan da CoinGecko, ~100 req/min, cobre top 2000 por market cap.
export async function getTopCoinMarkets(perPage = 100): Promise<CoinMarket[]> {
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&price_change_percentage=24h`;

  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko respondeu ${res.status}`);
  }

  return res.json();
}

export interface CoinHistoryPoint {
  date: string; // YYYY-MM-DD
  close: number;
}

// Histórico diário de preço via market_chart (sem API key). `days` cobre o range
// necessário para o backfill (ex.: 90 dias cobre a janela de 30 pregões do z-score).
export async function getCoinHistory(coinId: string, days = 90): Promise<CoinHistoryPoint[]> {
  const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

  const res = await fetch(url, {
    next: { revalidate: 6 * 60 * 60 },
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko respondeu ${res.status} para ${coinId}`);
  }

  const json = await res.json();
  const prices: [number, number][] = json.prices ?? [];

  // O último ponto do dia corrente pode aparecer duplicado (dois timestamps no
  // mesmo dia UTC) — mantemos apenas o mais recente por data para não quebrar o
  // upsert em lote (Postgres não aceita ON CONFLICT duas vezes na mesma data).
  const byDate = new Map<string, number>();
  for (const [ts, price] of prices) {
    byDate.set(new Date(ts).toISOString().slice(0, 10), price);
  }

  return Array.from(byDate.entries()).map(([date, close]) => ({ date, close }));
}
