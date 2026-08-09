import { unstable_cache } from "next/cache";

// TVL (Total Value Locked) por protocolo via DefiLlama — API pública, sem
// chave. Só faz sentido pra tokens de protocolo DeFi de verdade (ex.: JTO,
// AAVE, UNI) — L1s/blockchains (BTC, ETH, SOL) não têm "TVL próprio" nesse
// sentido, e o campo "symbol" da API às vezes bate por coincidência com
// protocolo pequeno/irrelevante de mesmo ticker (ex.: "SOL" bateu com um
// protocolo chamado "Solana Farm" com TVL de ~US$ 200 — nada a ver com a
// rede Solana). Filtra por TVL mínimo relevante + categoria pra reduzir
// esse risco de falso-positivo.
const PROTOCOLS_URL = "https://api.llama.fi/protocols";

const MIN_RELEVANT_TVL = 1_000_000; // abaixo disso, provavelmente é match por coincidência de símbolo
const EXCLUDED_CATEGORIES = new Set(["Foundation", "Canonical Bridge", "Chain", "CEX"]);

export interface ProtocolTvl {
  symbol: string;
  protocolName: string;
  category: string;
  tvlUsd: number;
  change1dPct: number | null;
  change7dPct: number | null;
}

interface DefiLlamaProtocol {
  symbol?: string;
  name: string;
  category?: string;
  tvl?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
}

// A resposta bruta da DefiLlama tem 10MB+ (todos os protocolos existentes) —
// acima do limite de 2MB do cache de fetch nativo do Next, então usa
// unstable_cache pra guardar só o resultado já filtrado/agregado (pequeno),
// não a resposta inteira. `fetch` aqui de propósito SEM `next.revalidate`,
// pra não disparar o aviso de cache de fetch que ia falhar de qualquer jeito.
async function computeProtocolTvl(symbols: string[]): Promise<ProtocolTvl[]> {
  const res = await fetch(PROTOCOLS_URL, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`DefiLlama respondeu ${res.status}`);
  const protocols: DefiLlamaProtocol[] = await res.json();

  const wanted = new Set(symbols.map((s) => s.toUpperCase()));
  // Um token pode ter várias versões de protocolo (Aave V1-V4, Uniswap V1-V4)
  // — agrupa por símbolo, soma o TVL, e usa a versão de maior TVL como
  // representante do nome/variação (mais significativa que a mais antiga).
  const bySymbol = new Map<string, DefiLlamaProtocol[]>();

  for (const p of protocols) {
    const symbol = p.symbol?.toUpperCase();
    if (!symbol || !wanted.has(symbol)) continue;
    if (!p.tvl || p.tvl < MIN_RELEVANT_TVL) continue;
    if (p.category && EXCLUDED_CATEGORIES.has(p.category)) continue;

    const list = bySymbol.get(symbol) ?? [];
    list.push(p);
    bySymbol.set(symbol, list);
  }

  const results: ProtocolTvl[] = [];
  for (const [symbol, list] of bySymbol) {
    const totalTvl = list.reduce((sum, p) => sum + (p.tvl ?? 0), 0);
    const largest = [...list].sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))[0];
    results.push({
      symbol,
      protocolName: list.length > 1 ? `${largest.name} +${list.length - 1}` : largest.name,
      category: largest.category ?? "—",
      tvlUsd: totalTvl,
      change1dPct: largest.change_1d ?? null,
      change7dPct: largest.change_7d ?? null,
    });
  }

  return results.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

export const getProtocolTvl = unstable_cache(computeProtocolTvl, ["defillama-tvl"], {
  revalidate: 60 * 60,
});
