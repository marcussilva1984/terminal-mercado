// Preço-alvo de analistas via Yahoo Finance quoteSummary (financialData) —
// requer um "crumb" de sessão (cookie + token), mas não viola ToS como o
// Finviz: é a mesma API pública que o próprio site do Yahoo usa, sem
// exigir cadastro/chave.
let cachedCrumb: { crumb: string; cookie: string } | null = null;

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb) return cachedCrumb;

  const cookieRes = await fetch("https://fc.yahoo.com", { headers: { "user-agent": "Mozilla/5.0" } });
  const cookie = cookieRes.headers.get("set-cookie") ?? "";

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "user-agent": "Mozilla/5.0", cookie },
  });
  const crumb = await crumbRes.text();

  cachedCrumb = { crumb, cookie };
  return cachedCrumb;
}

export interface AnalystTarget {
  symbol: string;
  currentPrice: number | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  recommendationMean: number | null; // 1 = compra forte, 5 = venda forte
  numberOfAnalysts: number | null;
}

export async function getAnalystTarget(symbol: string): Promise<AnalystTarget | null> {
  try {
    const { crumb, cookie } = await getCrumb();
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData&crumb=${encodeURIComponent(crumb)}`;
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", cookie }, next: { revalidate: 60 * 60 } });
    if (!res.ok) return null;

    const json = await res.json();
    const data = json?.quoteSummary?.result?.[0]?.financialData;
    if (!data) return null;

    return {
      symbol,
      currentPrice: data.currentPrice?.raw ?? null,
      targetMeanPrice: data.targetMeanPrice?.raw ?? null,
      targetHighPrice: data.targetHighPrice?.raw ?? null,
      targetLowPrice: data.targetLowPrice?.raw ?? null,
      recommendationMean: data.recommendationMean?.raw ?? null,
      numberOfAnalysts: data.numberOfAnalystOpinions?.raw ?? null,
    };
  } catch {
    return null;
  }
}

export async function getAnalystTargets(symbols: string[]): Promise<AnalystTarget[]> {
  const results = await Promise.all(symbols.map(getAnalystTarget));
  return results.filter((r): r is AnalystTarget => r !== null && r.targetMeanPrice !== null);
}
