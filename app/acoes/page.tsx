import { unstable_cache } from "next/cache";
import { Panel } from "@/components/Panel";
import { NewsFeed } from "@/components/NewsFeed";
import { FlowSemaphore } from "@/components/FlowSemaphore";
import { FlowBarChart } from "@/components/FlowBarChart";
import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments, getFlowChartData, SEGMENT_CONFIG } from "@/lib/semaphore";
import { getNews } from "@/lib/sources/rss";
import { getB3VolatilityRanking } from "@/lib/volatilityService";
import { getBaseUrl } from "@/lib/baseUrl";
import { B3_WATCHLIST } from "@/lib/watchlist";
import { hasDatabase } from "@/lib/db/client";
import { getB3MoneyFlowIdeas } from "@/lib/moneyFlowIdeas";
import { MoneyFlowIdeasList } from "@/components/MoneyFlowIdeasList";
import { InsightsList } from "@/components/InsightsList";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { formatNumber } from "@/lib/format";
import type { AnalystTarget } from "@/lib/sources/yahooAnalyst";
import { VolatilityTable } from "@/components/VolatilityTable";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";
import { FatosRelevantesTable } from "@/components/FatosRelevantesTable";

// Trocado de force-dynamic pra ISR (aprovado pelo usuário, depois estendido
// pra 3-5min em todo o site): a página junta ~10 fontes diferentes, então
// "sempre fresco" custava ~9s por visita mesmo com os agregadores
// individuais já cacheados. Com revalidate, a primeira visita depois da
// janela paga o custo cheio em segundo plano e todo mundo depois disso
// recebe a versão pronta — defasagem de até 4min, bem menor que o problema
// real que motivou "sempre fresco" no passado (dias de atraso por fonte
// quebrada, não minutos por cache).
export const revalidate = 240;

interface PriceTargetHit {
  symbol: string;
  currentPrice: number;
  targetMeanPrice: number;
}

async function computeB3PriceTargetHits(): Promise<PriceTargetHit[] | null> {
  try {
    const symbols = B3_WATCHLIST.map((w) => `${w.symbol}.SA`).join(",");
    const res = await fetch(`${getBaseUrl()}/api/analyst-targets?symbols=${encodeURIComponent(symbols)}`, {
      next: { revalidate: 120 },
    });
    const json = await res.json();
    if (!json.available) return null;
    const targets: AnalystTarget[] = json.data;
    return targets
      .filter((t) => t.currentPrice !== null && t.targetMeanPrice !== null && t.currentPrice >= t.targetMeanPrice)
      .map((t) => ({
        symbol: t.symbol.replace(".SA", ""),
        currentPrice: t.currentPrice as number,
        targetMeanPrice: t.targetMeanPrice as number,
      }));
  } catch {
    return null;
  }
}

interface UpcomingEarnings {
  symbol: string;
  label: string;
  nextEarningsDate: string;
}

async function computeUpcomingEarnings(): Promise<UpcomingEarnings[]> {
  const watchlist = hasDatabase() ? await getWatchlist("b3") : B3_WATCHLIST.map((w, i) => ({ ...w, id: i }));
  const results = await Promise.all(
    watchlist.map(async (w) => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/ticker-detail?symbol=${encodeURIComponent(`${w.symbol}.SA`)}`, {
          next: { revalidate: 120 },
        });
        const json = await res.json();
        if (json.available && json.data.nextEarningsDate) {
          return { symbol: w.symbol, label: w.label, nextEarningsDate: json.data.nextEarningsDate as string };
        }
      } catch {
        // fonte indisponível pra esse papel — segue pros demais
      }
      return null;
    })
  );
  const today = new Date().toISOString().slice(0, 10);
  return results
    .filter((r): r is UpcomingEarnings => r !== null && r.nextEarningsDate >= today)
    .sort((a, b) => a.nextEarningsDate.localeCompare(b.nextEarningsDate));
}

// As duas funções acima fazem dezenas de auto-fetches HTTP pro próprio app
// (uma por ativo da watchlist B3, hoje ~33) — sem cache isso rodava do zero
// em toda visita à página, sendo o motivo real da aba Ações continuar bem
// mais lenta que as outras mesmo depois de outras otimizações. Mesmo padrão
// de cache já usado nos outros agregadores pesados do site.
const getB3PriceTargetHits = unstable_cache(computeB3PriceTargetHits, ["b3-price-target-hits"], {
  revalidate: 15 * 60,
});
const getUpcomingEarnings = unstable_cache(computeUpcomingEarnings, ["b3-upcoming-earnings"], {
  revalidate: 15 * 60,
});

export default async function AcoesPage() {
  const now = new Date().toISOString();

  const [flowResult, newsResult, volatilityResult, fatosResult, priceTargetResult, earningsResult, ideasResult] =
    await Promise.allSettled([
      getFlowHistory(),
      getNews("b3", 10),
      getB3VolatilityRanking(),
      getFatosRelevantes(25),
      getB3PriceTargetHits(),
      getUpcomingEarnings(),
      getB3MoneyFlowIdeas(),
    ]);

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const volatility = volatilityResult.status === "fulfilled" ? volatilityResult.value : null;
  const fatosRelevantes = fatosResult.status === "fulfilled" ? fatosResult.value : null;
  const priceTargetHits = priceTargetResult.status === "fulfilled" ? priceTargetResult.value : null;
  const upcomingEarnings = earningsResult.status === "fulfilled" ? earningsResult.value : null;
  const moneyFlowIdeas = ideasResult.status === "fulfilled" ? ideasResult.value : null;

  const insights: string[] = [];
  if (flowResult.status === "fulfilled") {
    const segments = buildFlowSegments(flowResult.value);
    const estrangeiro = segments.find((s) => s.segment === "Estrangeiro");
    const institucional = segments.find((s) => s.segment === "Institucional");
    if (estrangeiro) {
      insights.push(
        `Fluxo estrangeiro ${estrangeiro.dailyBRL >= 0 ? "positivo" : "negativo"} hoje (R$ ${formatNumber(Math.abs(estrangeiro.dailyBRL) / 1e6)}M) — ${estrangeiro.dailyBRL >= 0 ? "compra líquida" : "venda líquida"} do mercado externo.`
      );
    }
    if (institucional) {
      insights.push(
        `Institucional ${institucional.dailyBRL >= 0 ? "comprador" : "vendedor"} líquido (R$ ${formatNumber(Math.abs(institucional.dailyBRL) / 1e6)}M).`
      );
    }
  }
  insights.push("Para próxima data de resultado (balanço) de uma ação específica, consulte a aba Fundamentalista.");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ações (B3)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Rankings via brapi.dev, filtrados por liquidez mínima (volume ≥ 300 mil) para evitar
          frações e papéis sem negociação relevante.
        </p>
      </div>

      {insights.length > 0 && (
        <Panel title="Insights do Dia" updatedAt={now}>
          <InsightsList items={insights} />
          <p className="mt-3 text-xs text-text-muted">
            Gerado a partir do fluxo de investidores — não atribui fluxo a um ticker específico (isso só existe no B3 DataWise+, pago).
          </p>
        </Panel>
      )}

      <Panel title="Onde o Dinheiro Está Indo" updatedAt={now}>
        {moneyFlowIdeas ? (
          <MoneyFlowIdeasList items={moneyFlowIdeas} />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>


      <Panel title="Fluxo de Investidores — Semáforo" updatedAt={now}>
        {flowResult.status === "fulfilled" ? (
          <FlowSemaphore segments={buildFlowSegments(flowResult.value)} />
        ) : (
          <p className="text-sm text-down">
            Fonte indisponível no momento
            {flowResult.status === "rejected" && flowResult.reason instanceof Error
              ? `: ${flowResult.reason.message}`
              : "."}
          </p>
        )}
      </Panel>

      <Panel title="Fluxo Diário — Infográfico" updatedAt={now}>
        {flowResult.status === "fulfilled" ? (
          <FlowBarChart
            segments={SEGMENT_CONFIG.map((s) => getFlowChartData(flowResult.value, s.key, 20))}
          />
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="Oportunidades — Watchlist B3" updatedAt={now}>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Preço-Alvo dos Analistas Atingido
            </h3>
            {priceTargetHits ? (
              priceTargetHits.length > 0 ? (
                <ul className="flex flex-col divide-y divide-border/50">
                  {priceTargetHits.map((t) => (
                    <li key={t.symbol} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <a href={`/ticker/${t.symbol}?class=b3`} className="text-sm font-medium text-gold-bright hover:underline">
                        {t.symbol}
                      </a>
                      <span className="text-sm text-text">
                        R$ {formatNumber(t.currentPrice)}{" "}
                        <span className="text-text-muted">(alvo R$ {formatNumber(t.targetMeanPrice)})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">Nenhum papel da watchlist bateu o alvo médio dos analistas agora.</p>
              )
            ) : (
              <p className="text-sm text-down">Fonte indisponível no momento.</p>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Volatilidade — proxy de risco (não é short interest)" updatedAt={now}>
          {volatility ? (
            <VolatilityTable items={volatility} />
          ) : (
            <p className="text-sm text-down">
              Fonte indisponível{volatilityResult.status === "rejected" && volatilityResult.reason instanceof Error
                ? `: ${volatilityResult.reason.message}`
                : "."}
            </p>
          )}
        </Panel>
      </div>
      <p className="text-xs text-text-muted">
        Sobre &quot;mais alugadas/alavancadas&quot;: não existe fonte gratuita real para B3 (o
        TradersClub bloqueia acesso automatizado via Cloudflare, e dívida/patrimônio exige dados
        fundamentalistas trimestrais que nenhuma API grátis expõe). Usamos volatilidade calculada
        como proxy de risco no lugar, deixado explícito acima. Para o dado oficial de posições
        alugadas, consulte diretamente em{" "}
        <a
          href="https://tc.tradersclub.com.br/mais-alugadas-b3"
          target="_blank"
          rel="noreferrer"
          className="text-gold-bright hover:underline"
        >
          tc.tradersclub.com.br/mais-alugadas-b3
        </a>
        .
      </p>

      <Panel title="Próximos Resultados (Watchlist)" updatedAt={now}>
        {upcomingEarnings && upcomingEarnings.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/50">
            {upcomingEarnings.map((e) => (
              <li key={e.symbol} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-sm">
                <span className="text-text">
                  {e.symbol} <span className="text-text-muted">— {e.label}</span>
                </span>
                <span className="text-gold-bright">{new Date(e.nextEarningsDate).toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Nenhuma data de resultado futura disponível pra watchlist agora.</p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Data estimada de divulgação de resultado (balanço), via Yahoo Finance, pros papéis da sua{" "}
          <a href="/watchlist" className="text-gold-bright hover:underline">
            Watchlist
          </a>
          .
        </p>
      </Panel>

      <Panel title="Fatos Relevantes (CVM)" updatedAt={now}>
        {fatosRelevantes ? (
          <FatosRelevantesTable items={fatosRelevantes} />
        ) : (
          <p className="text-sm text-down">
            Fonte indisponível{fatosResult.status === "rejected" && fatosResult.reason instanceof Error ? `: ${fatosResult.reason.message}` : "."}
          </p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Direto da CVM (dados abertos oficiais) — comunicados obrigatórios de eventos relevantes de todas as
          companhias abertas do mercado brasileiro, atualizado conforme a CVM publica.
        </p>
      </Panel>

      <Panel title="Notícias Brasil / B3" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
