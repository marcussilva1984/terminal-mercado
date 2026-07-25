import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { RankingPanel } from "@/components/RankingPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { getYahooQuote } from "@/lib/sources/yahoo";
import { getBrapiRanking, type BrapiListItem } from "@/lib/sources/brapi";
import { getFiiDividendYieldRanking } from "@/lib/sources/investidor10";
import { getNews } from "@/lib/sources/rss";
import { formatNumber } from "@/lib/format";
import type { RankingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function toRankingItem(item: BrapiListItem): RankingItem {
  return { symbol: item.symbol, label: item.name, value: item.close, changePct: item.changePct, volume: item.volume };
}

export default async function FiiPage() {
  const now = new Date().toISOString();

  const [ifixResult, gainersResult, losersResult, dyResult, news] = await Promise.all([
    getYahooQuote("IFIX.SA").catch(() => null),
    getBrapiRanking("change", "desc", 20, "fund").catch(() => null),
    getBrapiRanking("change", "asc", 20, "fund").catch(() => null),
    getFiiDividendYieldRanking(20).catch(() => null),
    getNews("fii", 10),
  ]);

  const gainers = gainersResult?.map(toRankingItem) ?? null;
  const losers = losersResult?.map(toRankingItem) ?? null;

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gainers ? (
          <RankingPanel title="Maiores Altas de Cota" items={gainers} updatedAt={now} valueLabel="Cota (R$)" format="price-brl" />
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
