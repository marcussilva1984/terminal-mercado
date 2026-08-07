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

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
  priceChangePct24h: number | null;
}

// "Onde a atenção do mercado cripto está agora" — ranking de busca da própria
// CoinGecko (proxy de relevância/interesse, sem precisar de rede social).
// Sem API key.
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const url = `${COINGECKO_BASE}/search/trending`;

  const res = await fetch(url, {
    next: { revalidate: 10 * 60 },
    headers: { accept: "application/json" },
  });

  if (!res.ok) throw new Error(`CoinGecko respondeu ${res.status}`);

  const json = await res.json();
  const coins: {
    item: {
      id: string;
      symbol: string;
      name: string;
      market_cap_rank: number | null;
      data?: { price_change_percentage_24h?: { usd?: number } };
    };
  }[] = json.coins ?? [];

  return coins.map(({ item }) => ({
    id: item.id,
    symbol: item.symbol.toUpperCase(),
    name: item.name,
    marketCapRank: item.market_cap_rank,
    priceChangePct24h: item.data?.price_change_percentage_24h?.usd ?? null,
  }));
}

export interface CoinCategory {
  id: string;
  name: string;
  marketCap: number;
  marketCapChange24h: number | null;
  volume24h: number;
}

const MIN_CATEGORY_MARKET_CAP = 5_000_000_000; // filtra categorias minúsculas/ruído

// Setores/categorias de cripto (DeFi, Layer 1, Meme, etc.), sem API key.
// Filtra categorias muito pequenas para não poluir o ranking com ruído.
export async function getCoinCategories(): Promise<CoinCategory[]> {
  const url = `${COINGECKO_BASE}/coins/categories?order=market_cap_desc`;

  const res = await fetch(url, {
    next: { revalidate: 15 * 60 },
    headers: { accept: "application/json" },
  });

  if (!res.ok) throw new Error(`CoinGecko respondeu ${res.status}`);

  const raw: {
    id: string;
    name: string;
    market_cap: number;
    market_cap_change_24h: number | null;
    volume_24h: number;
  }[] = await res.json();

  return raw
    .filter((c) => c.market_cap >= MIN_CATEGORY_MARKET_CAP)
    .map((c) => ({
      id: c.id,
      name: c.name,
      marketCap: c.market_cap,
      marketCapChange24h: c.market_cap_change_24h,
      volume24h: c.volume_24h,
    }));
}
