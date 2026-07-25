export interface BrapiHistoricalPoint {
  date: string; // YYYY-MM-DD
  close: number;
}

const BRAPI_BASE = "https://brapi.dev/api";

// Sem BRAPI_TOKEN, só PETR4/VALE3/MGLU3/ITUB4 funcionam sem limite de requisições.
export async function getBrapiHistory(symbol: string, range = "3mo"): Promise<BrapiHistoricalPoint[]> {
  const token = process.env.BRAPI_TOKEN;
  const url = new URL(`${BRAPI_BASE}/quote/${symbol}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", "1d");
  if (token) url.searchParams.set("token", token);

  const res = await fetch(url.toString(), { next: { revalidate: 6 * 60 * 60 } });
  if (!res.ok) throw new Error(`brapi.dev respondeu ${res.status} para ${symbol}`);

  const json = await res.json();
  const result = json?.results?.[0];
  const history = result?.historicalDataPrice ?? [];

  return history
    .filter((h: { close?: number }) => typeof h.close === "number")
    .map((h: { date: number; close: number }) => ({
      date: new Date(h.date * 1000).toISOString().slice(0, 10),
      close: h.close,
    }));
}

export async function getBrapiLastClose(symbol: string): Promise<BrapiHistoricalPoint | null> {
  const history = await getBrapiHistory(symbol, "5d");
  return history.length > 0 ? history[history.length - 1] : null;
}

export interface BrapiListItem {
  symbol: string;
  name: string;
  close: number;
  changePct: number;
  volume: number;
  marketCap: number;
}

const MIN_VOLUME_FOR_RANKING: Record<"stock" | "fund", number> = {
  stock: 300_000, // filtra ações/frações pouco líquidas do ranking
  fund: 1_000, // FIIs negociam em cotas, volume naturalmente bem menor que ações
};

// Ranking de mercado inteiro (sem token, ~780 papéis / ~450 fundos). Pede uma página
// maior e filtra por liquidez mínima porque os maiores % de variação do dia costumam
// ser papéis sem negociação relevante (frações, BDRs ilíquidos, cotas paradas).
export async function getBrapiRanking(
  sortBy: "change" | "volume",
  sortOrder: "asc" | "desc",
  limit = 20,
  type: "stock" | "fund" = "stock"
): Promise<BrapiListItem[]> {
  const token = process.env.BRAPI_TOKEN;
  const url = new URL(`${BRAPI_BASE}/quote/list`);
  url.searchParams.set("sortBy", sortBy);
  url.searchParams.set("sortOrder", sortOrder);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", "200");
  if (token) url.searchParams.set("token", token);

  const res = await fetch(url.toString(), { next: { revalidate: 5 * 60 } });
  if (!res.ok) throw new Error(`brapi.dev respondeu ${res.status} para ranking`);

  const json = await res.json();
  const stocks: {
    stock: string;
    name: string;
    close: number;
    change: number;
    volume: number;
    market_cap: number;
  }[] = json?.stocks ?? [];

  return stocks
    .filter((s) => s.volume >= MIN_VOLUME_FOR_RANKING[type])
    .slice(0, limit)
    .map((s) => ({
      symbol: s.stock,
      name: s.name,
      close: s.close,
      changePct: s.change,
      volume: s.volume,
      marketCap: s.market_cap,
    }));
}
