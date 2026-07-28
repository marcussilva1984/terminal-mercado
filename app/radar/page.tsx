import Link from "next/link";
import { Panel } from "@/components/Panel";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { VolatilityTable } from "@/components/VolatilityTable";
import { FatosRelevantesTable } from "@/components/FatosRelevantesTable";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getB3VolatilityRanking } from "@/lib/volatilityService";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";
import { getBaseUrl } from "@/lib/baseUrl";
import { B3_WATCHLIST, STOCKS_WATCHLIST } from "@/lib/watchlist";
import { formatNumber } from "@/lib/format";
import type { AnalystTarget } from "@/lib/sources/yahooAnalyst";

export const dynamic = "force-dynamic";

interface PriceTargetHit {
  symbol: string;
  isB3: boolean;
  currentPrice: number;
  targetMeanPrice: number;
}

async function getPriceTargetHits(): Promise<PriceTargetHit[] | null> {
  try {
    const stockSymbols = STOCKS_WATCHLIST.map((w) => w.symbol);
    const b3Symbols = B3_WATCHLIST.map((w) => `${w.symbol}.SA`);
    const symbols = [...stockSymbols, ...b3Symbols].join(",");
    const res = await fetch(`${getBaseUrl()}/api/analyst-targets?symbols=${encodeURIComponent(symbols)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!json.available) return null;
    const targets: AnalystTarget[] = json.data;
    return targets
      .filter((t) => t.currentPrice !== null && t.targetMeanPrice !== null && t.currentPrice >= t.targetMeanPrice)
      .map((t) => ({
        symbol: t.symbol.endsWith(".SA") ? t.symbol.replace(".SA", "") : t.symbol,
        isB3: t.symbol.endsWith(".SA"),
        currentPrice: t.currentPrice as number,
        targetMeanPrice: t.targetMeanPrice as number,
      }));
  } catch {
    return null;
  }
}

export default async function RadarPage() {
  const now = new Date().toISOString();

  const [zScoreResult, volatilityResult, fatosResult, priceTargetHits] = await Promise.allSettled([
    getZScoreHighlights(),
    getB3VolatilityRanking(),
    getFatosRelevantes(15),
    getPriceTargetHits(),
  ]);

  const zScoreHighlights = zScoreResult.status === "fulfilled" ? zScoreResult.value : null;
  const volatility = volatilityResult.status === "fulfilled" ? volatilityResult.value : null;
  const fatosRelevantes = fatosResult.status === "fulfilled" ? fatosResult.value : null;
  const targetHits = priceTargetHits.status === "fulfilled" ? priceTargetHits.value : null;

  const extremeZScores = zScoreHighlights?.filter((z) => Math.abs(z.zScore) >= 2) ?? [];
  const topVolatility = volatility?.slice(0, 5) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Radar de Oportunidades</h1>
        <p className="mt-1 text-sm text-text-muted">
          Junta os principais destaques de todas as abas num lugar só: z-score fora do padrão,
          volatilidade alta, preço-alvo de analistas batido e fatos relevantes recentes da B3. Baseado
          na sua{" "}
          <Link href="/watchlist" className="text-gold-bright hover:underline">
            Watchlist
          </Link>
          .
        </p>
      </div>

      <Panel title="Z-Score fora do padrão (|z| ≥ 2)" updatedAt={now}>
        {zScoreHighlights ? (
          extremeZScores.length > 0 ? (
            <ZScoreHighlightList items={extremeZScores} />
          ) : (
            <p className="text-sm text-text-muted">Nenhum ativo da watchlist com movimento fora do padrão agora.</p>
          )
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
          </p>
        )}
      </Panel>

      <Panel title="Preço-Alvo dos Analistas Atingido" updatedAt={now}>
        {targetHits ? (
          targetHits.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border/50">
              {targetHits.map((t) => (
                <li key={`${t.isB3 ? "b3" : "stocks"}-${t.symbol}`} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <Link
                    href={`/ticker/${t.symbol}?class=${t.isB3 ? "b3" : "stocks"}`}
                    className="text-sm font-medium text-gold-bright hover:underline"
                  >
                    {t.symbol}
                  </Link>
                  <span className="text-sm text-text">
                    {t.isB3 ? "R$" : "US$"} {formatNumber(t.currentPrice)}{" "}
                    <span className="text-text-muted">
                      (alvo {t.isB3 ? "R$" : "US$"} {formatNumber(t.targetMeanPrice)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Nenhum ativo da watchlist bateu o alvo médio dos analistas agora.</p>
          )
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Cobre B3 e Stocks (watchlist). FII e Cripto não têm cobertura de analistas em nenhuma fonte
          gratuita disponível.
        </p>
      </Panel>

      <Panel title="Maior Volatilidade — B3" updatedAt={now}>
        <VolatilityTable items={topVolatility} />
      </Panel>

      <Panel title="Fatos Relevantes Recentes (CVM)" updatedAt={now}>
        {fatosRelevantes ? (
          <FatosRelevantesTable items={fatosRelevantes} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>
    </div>
  );
}
