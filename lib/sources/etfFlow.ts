// Fluxo líquido dos ETFs spot de cripto (EUA) via SoSoValue — API pública,
// sem chave, usada pelo próprio site sosovalue.com. Só existe ETF spot
// aprovado pra BTC, ETH e SOL até agora; HYPE e LINK não têm ETF nenhum
// (a API confirma isso retornando status "3" = sem dado, não vamos fingir
// que existe).
const SOSOVALUE_URL = "https://api.sosovalue.xyz/openapi/v2/etf/currentEtfDataMetrics";

export type EtfAsset = "btc" | "eth" | "sol";

const ASSET_TYPE: Record<EtfAsset, string> = {
  btc: "us-btc-spot",
  eth: "us-eth-spot",
  sol: "us-sol-spot",
};

export interface EtfFundFlow {
  ticker: string;
  institute: string;
  dailyNetInflow: number;
  netAssets: number;
}

export interface EtfFlowSnapshot {
  asset: EtfAsset;
  totalNetAssetsUsd: number;
  dailyNetInflowUsd: number;
  cumNetInflowUsd: number;
  funds: EtfFundFlow[];
  updatedAt: string | null;
}

async function fetchOne(asset: EtfAsset): Promise<EtfFlowSnapshot | null> {
  try {
    const res = await fetch(SOSOVALUE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: ASSET_TYPE[asset] }),
      next: { revalidate: 30 * 60 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data || data.totalNetAssets?.status !== "1") return null;

    const funds: EtfFundFlow[] = (data.list ?? [])
      .map((f: Record<string, { value?: string }>) => ({
        ticker: f.ticker as unknown as string,
        institute: (f.institute as unknown as string)?.trim(),
        dailyNetInflow: parseFloat(f.dailyNetInflow?.value ?? "0"),
        netAssets: parseFloat(f.netAssets?.value ?? "0"),
      }))
      .sort((a: EtfFundFlow, b: EtfFundFlow) => Math.abs(b.dailyNetInflow) - Math.abs(a.dailyNetInflow));

    return {
      asset,
      totalNetAssetsUsd: parseFloat(data.totalNetAssets?.value ?? "0"),
      dailyNetInflowUsd: parseFloat(data.dailyNetInflow?.value ?? "0"),
      cumNetInflowUsd: parseFloat(data.cumNetInflow?.value ?? "0"),
      funds,
      updatedAt: data.totalNetAssets?.lastUpdateDate ?? null,
    };
  } catch {
    return null;
  }
}

// Só busca os ativos que realmente têm ETF spot aprovado — não tenta
// HYPE/LINK, que não existem nessa modalidade.
export async function getEtfFlows(): Promise<EtfFlowSnapshot[]> {
  const assets: EtfAsset[] = ["btc", "eth", "sol"];
  const results = await Promise.all(assets.map(fetchOne));
  return results.filter((r): r is EtfFlowSnapshot => r !== null);
}
