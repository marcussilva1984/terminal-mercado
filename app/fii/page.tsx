import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { getYahooQuote } from "@/lib/sources/yahoo";
import { getBrapiRanking, getFiiSectorPerformance, type BrapiListItem } from "@/lib/sources/brapi";
import { getFiiDividendYieldRanking } from "@/lib/sources/investidor10";
import { getNews } from "@/lib/sources/rss";
import { formatNumber } from "@/lib/format";
import { buildGenericInsights } from "@/lib/insights";
import type { RankingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function toRankingItem(item: BrapiListItem): RankingItem {
  return { symbol: item.symbol, label: item.name, value: item.close, changePct: item.changePct, volume: item.volume };
}

export default async function FiiPage() {
  const now = new Date().toISOString();

  const [ifixResult, gainersResult, losersResult, dyResult, sectorResult, news] = await Promise.all([
    getYahooQuote("IFIX.SA").catch(() => null),
    getBrapiRanking("change", "desc", 20, "fund").catch(() => null),
    getBrapiRanking("change", "asc", 20, "fund").catch(() => null),
    getFiiDividendYieldRanking(20).catch(() => null),
    getFiiSectorPerformance().catch(() => null),
    getNews("fii", 10),
  ]);

  const gainers = gainersResult?.map(toRankingItem) ?? null;
  const losers = losersResult?.map(toRankingItem) ?? null;

  const insights: string[] = [];
  if (gainers && losers) {
    insights.push(...buildGenericInsights(gainers, losers, gainers));
  }

  // DY acima de ~25%/ano é quase sempre anomalia de dado (fundo em liquidação,
  // amortização pontual etc.), não rendimento real recorrente — não destaca.
  const plausibleDYs = dyResult?.filter((f) => f.dividendYieldPct > 0 && f.dividendYieldPct <= 25).slice(0, 3) ?? [];
  plausibleDYs.forEach((f, i) => {
    insights.push(
      i === 0
        ? `${f.symbol} lidera dividend yield 12m entre os fundos líquidos (${formatNumber(f.dividendYieldPct)}%).`
        : `${f.symbol} também entre os maiores DY 12m (${formatNumber(f.dividendYieldPct)}%).`
    );
  });

  if (sectorResult && sectorResult.length > 0) {
    const bestSectors = sectorResult.slice(0, 3).filter((s) => s.avgChangePct > 0);
    const worstSectors = sectorResult.slice(-2).filter((s) => s.avgChangePct < 0);
    bestSectors.forEach((s, i) => {
      insights.push(
        i === 0
          ? `Segmento ${s.subsector} lidera o dia (${formatNumber(s.avgChangePct)}%), entre ${s.count} fundos líquidos.`
          : `Segmento ${s.subsector} também em alta (${formatNumber(s.avgChangePct)}%).`
      );
    });
    worstSectors.forEach((s) => {
      insights.push(`Segmento ${s.subsector} é dos piores do dia (${formatNumber(s.avgChangePct)}%).`);
    });
  }

  if (ifixResult) {
    insights.push(
      `IFIX ${ifixResult.changePct >= 0 ? "sobe" : "cai"} ${formatNumber(Math.abs(ifixResult.changePct))}% hoje — leitura geral do humor do mercado de FIIs.`
    );
  }

  insights.push(
    "Para próxima data de dividendo (ex-dividendo) de um fundo específico, consulte a aba Fundamentalista do fundo."
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">FII</h1>
        <p className="mt-1 text-sm text-text-muted">
          IFIX e rankings via Yahoo Finance / brapi.dev; dividend yield via investidor10.com.br.
        </p>
      </div>

      {ifixResult && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="IFIX" value={formatNumber(ifixResult.price)} changePct={ifixResult.changePct} />
        </div>
      )}

      {insights.length > 0 && (
        <Panel title="Insights do Dia" updatedAt={now}>
          <ul className="flex flex-col gap-2 text-sm text-text">
            {insights.slice(0, 10).map((insight, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-bright">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gainers ? (
          <RankingPanel title="Maiores Altas de Cota" items={gainers} updatedAt={now} valueLabel="Cota (R$)" format="price-brl" assetClass="fii" />
        ) : (
          <Panel title="Maiores Altas de Cota" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
        {losers ? (
          <RankingPanel
            title="Maiores Baixas de Cota (proxy de 'mais vendidos')"
            items={losers}
            updatedAt={now}
            valueLabel="Cota (R$)"
            format="price-brl"
            assetClass="fii"
          />
        ) : (
          <Panel title="Maiores Baixas de Cota" updatedAt={now}>
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          </Panel>
        )}
      </div>

      <Panel title="Maiores Dividend Yields (12 meses)" updatedAt={now}>
        {dyResult ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="pb-2 font-medium">Fundo</th>
                <th className="pb-2 font-medium text-right">DY 12m</th>
              </tr>
            </thead>
            <tbody>
              {dyResult.map((f) => (
                <tr key={f.symbol} className="border-b border-border/50 last:border-0">
                  <td className="py-2">
                    <div className="font-medium text-text">{f.symbol}</div>
                    <div className="text-xs text-text-muted">{f.name}</div>
                  </td>
                  <td className="py-2 text-right text-up">{formatNumber(f.dividendYieldPct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
      </Panel>

      <Panel title="Desempenho por Segmento" updatedAt={now}>
        {sectorResult && sectorResult.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/50">
            {sectorResult.map((s) => (
              <li key={s.subsector} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-text">
                  {s.subsector} <span className="text-text-muted">({s.count} fundos)</span>
                </span>
                <span className={s.avgChangePct >= 0 ? "text-up" : "text-down"}>
                  {s.avgChangePct >= 0 ? "+" : ""}
                  {s.avgChangePct.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-down">Fonte indisponível no momento.</p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Variação média das cotas por segmento (mínimo de 3 fundos líquidos por segmento).
        </p>
      </Panel>

      <p className="text-xs text-text-muted">
        Não existe fluxo público por tipo de investidor por fundo — &ldquo;mais vendidos&rdquo; aqui é
        só a maior queda de cota do dia, um proxy, não um dado oficial de fluxo.
      </p>

      <Panel title="Notícias FII" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
