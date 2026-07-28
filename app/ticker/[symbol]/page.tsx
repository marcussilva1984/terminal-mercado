import Link from "next/link";
import { Panel } from "@/components/Panel";
import { TickerChart } from "@/components/TickerChart";
import { TickerSwitcher } from "@/components/TickerSwitcher";
import { TickerTabs } from "@/components/TickerTabs";
import { ShareholdersTable, InsiderFlowTable } from "@/components/ShareholdersInsidersB3";
import { FullIndicatorsPanel } from "@/components/FullIndicatorsPanel";
import { getMajorShareholders, getInsiderFlow, getFullIndicators } from "@/lib/sources/fundamentus";
import { getBaseUrl } from "@/lib/baseUrl";
import { formatNumber, formatPct, formatCompact, changeColorClass } from "@/lib/format";
import { classifyIndicator, TONE_CLASS } from "@/lib/indicatorColor";
import type { TickerDetail } from "@/lib/sources/yahooTickerDetail";

export const dynamic = "force-dynamic";

type AssetClassParam = "b3" | "cripto" | "stocks" | "fii";

// Mapeia a classe do ativo pro símbolo que o Yahoo Finance espera.
function toYahooSymbol(symbol: string, assetClass: AssetClassParam): string {
  if (assetClass === "b3" || assetClass === "fii") return `${symbol}.SA`;
  if (assetClass === "cripto") return `${symbol}-USD`;
  return symbol;
}

function recomLabel(recom: number | null): string {
  if (recom === null) return "—";
  if (recom <= 1.5) return "Compra forte";
  if (recom <= 2.5) return "Compra";
  if (recom <= 3.5) return "Neutro";
  if (recom <= 4.5) return "Venda";
  return "Venda forte";
}

export default async function TickerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  const { symbol } = await params;
  const { class: assetClassRaw } = await searchParams;
  const assetClass = (["b3", "cripto", "stocks", "fii"].includes(assetClassRaw ?? "") ? assetClassRaw : "stocks") as AssetClassParam;
  const yahooSymbol = toYahooSymbol(symbol, assetClass);

  let data: TickerDetail | null = null;
  let error: string | undefined;

  try {
    const res = await fetch(`${getBaseUrl()}/api/ticker-detail?symbol=${encodeURIComponent(yahooSymbol)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json.available) data = json.data;
    else error = json.error;
  } catch (err) {
    error = err instanceof Error ? err.message : "Falha ao carregar dados";
  }

  const [shareholdersResult, insiderFlowResult, fullIndicatorsResult] =
    assetClass === "b3"
      ? await Promise.allSettled([getMajorShareholders(symbol), getInsiderFlow(symbol), getFullIndicators(symbol)])
      : [null, null, null];
  const shareholders = shareholdersResult?.status === "fulfilled" ? shareholdersResult.value : null;
  const insiderFlow = insiderFlowResult?.status === "fulfilled" ? insiderFlowResult.value : null;
  const fullIndicators = fullIndicatorsResult?.status === "fulfilled" ? fullIndicatorsResult.value : null;

  const backHref = { b3: "/acoes", cripto: "/cripto", stocks: "/stocks", fii: "/fii" }[assetClass];

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Link href={backHref} className="text-sm text-gold-bright hover:underline">
          ← Voltar
        </Link>
        <Panel title={symbol}>
          <p className="text-sm text-down">Fonte indisponível no momento{error ? `: ${error}` : "."}</p>
        </Panel>
      </div>
    );
  }

  const currency = assetClass === "b3" || assetClass === "fii" ? "BRL" : "USD";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-gold-bright hover:underline">
          ← Voltar
        </Link>
        <TickerSwitcher defaultClass={assetClass} />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">
            {symbol} <span className="text-sm font-normal text-text-muted">{data.shortName}</span>
          </h1>
        </div>
        {data.price !== null && (
          <div className="text-right">
            <div className="text-2xl font-semibold text-text">
              {currency === "BRL" ? "R$" : "US$"} {formatNumber(data.price)}
            </div>
            {data.changePct !== null && (
              <div className={`text-sm font-medium ${changeColorClass(data.changePct)}`}>{formatPct(data.changePct)}</div>
            )}
          </div>
        )}
      </div>

      <TickerTabs
        overview={
          <>
            <Panel title="Indicadores">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["P/L", data.trailingPE !== null ? formatNumber(data.trailingPE) : "—"],
                  ["P/L Futuro", data.forwardPE !== null ? formatNumber(data.forwardPE) : "—"],
                  ["P/VP", data.priceToBook !== null ? formatNumber(data.priceToBook) : "—"],
                  ["Div. Yield", data.dividendYield !== null ? `${formatNumber(data.dividendYield)}%` : "—"],
                  ["Beta", data.beta !== null ? formatNumber(data.beta) : "—"],
                  ["Dív./Patrim.", data.debtToEquity !== null ? `${formatNumber(data.debtToEquity)}%` : "—"],
                  ["ROE", data.returnOnEquity !== null ? `${formatNumber(data.returnOnEquity)}%` : "—"],
                  ["Margem Líquida", data.profitMargin !== null ? `${formatNumber(data.profitMargin)}%` : "—"],
                  ["Market Cap", data.marketCap !== null ? formatCompact(data.marketCap, currency === "BRL" ? "R$" : "US$") : "—"],
                  ["Mín. 52 sem.", data.fiftyTwoWeekLow ? formatNumber(data.fiftyTwoWeekLow) : "—"],
                  ["Máx. 52 sem.", data.fiftyTwoWeekHigh !== null ? formatNumber(data.fiftyTwoWeekHigh) : "—"],
                  ["Próximo Resultado", data.nextEarningsDate ? new Date(data.nextEarningsDate).toLocaleDateString("pt-BR") : "—"],
                  ["Próx. Ex-Dividendo", data.exDividendDate ? new Date(data.exDividendDate).toLocaleDateString("pt-BR") : "—"],
                  ["Free Float", data.freeFloatPct !== null ? `${formatNumber(data.freeFloatPct)}%` : "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-text-muted">{label}</div>
                    <div className={`text-sm font-medium ${TONE_CLASS[classifyIndicator(label, value)]}`}>{value}</div>
                  </div>
                ))}
              </div>
              {data.freeFloatPct !== null && (
                <p className="mt-3 text-xs text-text-muted">
                  Free float via Yahoo Finance (ações em circulação / total de ações). Não existe fonte
                  gratuita de volume de aluguel de ações (a B3/TradersClub bloqueiam acesso automatizado) —
                  com o free float em mãos e o volume alugado que você acompanha manualmente, dá pra
                  calcular a proporção: <span className="text-text">volume alugado ÷ free float</span>.
                </p>
              )}
            </Panel>

            {data.targetMeanPrice !== null ? (
              <Panel title="Preço-Alvo dos Analistas">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-text-muted">Alvo Médio</div>
                    <div className="text-sm font-medium text-gold-bright">{formatNumber(data.targetMeanPrice)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Faixa</div>
                    <div className="text-sm font-medium text-text">
                      {data.targetLowPrice !== null ? formatNumber(data.targetLowPrice) : "—"} —{" "}
                      {data.targetHighPrice !== null ? formatNumber(data.targetHighPrice) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Nº Analistas</div>
                    <div className="text-sm font-medium text-text">{data.numberOfAnalysts ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Recomendação</div>
                    <div className="text-sm font-medium text-text">{recomLabel(data.recommendationMean)}</div>
                  </div>
                </div>

                {data.upgradeHistory.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-text-muted">
                          <th className="pb-2 font-medium">Data</th>
                          <th className="pb-2 font-medium">Casa (quem avaliou)</th>
                          <th className="pb-2 font-medium">Rating</th>
                          <th className="pb-2 font-medium text-right">Preço-Alvo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.upgradeHistory.map((h, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 text-text-muted">{new Date(h.date).toLocaleDateString("pt-BR")}</td>
                            <td className="py-1.5 text-text">{h.firm}</td>
                            <td className="py-1.5 text-text">{h.toGrade}</td>
                            <td className="py-1.5 text-right text-text">
                              {h.currentPriceTarget !== null ? (
                                <>
                                  {h.priorPriceTarget !== null && h.priorPriceTarget > 0 && h.priorPriceTarget !== h.currentPriceTarget
                                    ? `${formatNumber(h.priorPriceTarget)} → `
                                    : ""}
                                  {formatNumber(h.currentPriceTarget)}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-text-muted">
                      Coluna &quot;Casa&quot; mostra qual corretora/banco fez a avaliação (ex: JP Morgan, UBS,
                      Morgan Stanley) — dá pra comparar reputação e histórico de acerto de cada uma ao longo do tempo.
                    </p>
                  </div>
                )}
              </Panel>
            ) : (
              <Panel title="Preço-Alvo dos Analistas">
                <p className="text-sm text-text-muted">
                  Sem cobertura de analistas pra {symbol} no Yahoo Finance
                  {assetClass === "fii" || assetClass === "cripto" ? " (esperado — fundos e cripto não têm equity research)." : "."}
                </p>
              </Panel>
            )}

            {assetClass === "b3" && (
              <>
                <Panel title="Indicadores Completos (Fundamentus)">
                  {fullIndicators ? (
                    <FullIndicatorsPanel sections={fullIndicators} />
                  ) : (
                    <p className="text-sm text-down">Fonte indisponível no momento.</p>
                  )}
                </Panel>
                <Panel title="Principais Acionistas">
                  {shareholders ? (
                    <ShareholdersTable items={shareholders} />
                  ) : (
                    <p className="text-sm text-down">Fonte indisponível no momento.</p>
                  )}
                </Panel>
                <Panel title="Insiders (Fundamentus)">
                  {insiderFlow ? (
                    <InsiderFlowTable items={insiderFlow} />
                  ) : (
                    <p className="text-sm text-down">Fonte indisponível no momento.</p>
                  )}
                </Panel>
              </>
            )}
          </>
        }
        chart={
          <Panel title="Gráfico">
            <TickerChart symbol={yahooSymbol} currency={currency} />
          </Panel>
        }
      />
    </div>
  );
}
