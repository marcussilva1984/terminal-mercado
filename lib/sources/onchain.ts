// Métricas on-chain via Coin Metrics Community API (gratuita, sem chave) — cobertura
// real só para BTC e ETH nesse tier; altcoins (SOL, SUI etc.) não têm dados on-chain
// disponíveis de graça, por isso o painel fica restrito a essas duas moedas.

const CM_BASE = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics";

export interface OnChainSnapshot {
  asset: "BTC" | "ETH";
  mvrv: number | null;
  activeAddresses: number | null;
  txCount: number | null;
}

async function fetchMetric(asset: string, metric: string): Promise<number | null> {
  try {
    const url = `${CM_BASE}?assets=${asset}&metrics=${metric}&page_size=2&frequency=1d`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    const rows: { [k: string]: string }[] = json?.data ?? [];
    const last = rows[rows.length - 1];
    if (!last || !last[metric]) return null;
    return parseFloat(last[metric]);
  } catch {
    return null;
  }
}

async function fetchAssetSnapshot(asset: "btc" | "eth"): Promise<OnChainSnapshot> {
  const [mvrv, activeAddresses, txCount] = await Promise.all([
    fetchMetric(asset, "CapMVRVCur"),
    fetchMetric(asset, "AdrActCnt"),
    fetchMetric(asset, "TxCnt"),
  ]);
  return { asset: asset.toUpperCase() as "BTC" | "ETH", mvrv, activeAddresses, txCount };
}

export async function getOnChainSnapshot(): Promise<OnChainSnapshot[]> {
  return Promise.all([fetchAssetSnapshot("btc"), fetchAssetSnapshot("eth")]);
}

export interface FearGreedPoint {
  value: number;
  classification: string;
}

// Índice de sentimento do mercado cripto como um todo (não por ativo) — gratuito,
// sem chave, via alternative.me.
export async function getFearGreedIndex(): Promise<FearGreedPoint | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", { next: { revalidate: 60 * 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    const entry = json?.data?.[0];
    if (!entry) return null;
    return { value: parseInt(entry.value, 10), classification: entry.value_classification };
  } catch {
    return null;
  }
}
