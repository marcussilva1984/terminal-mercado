import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { NewsFeed } from "@/components/NewsFeed";
import { changeColorClass, formatPct, formatPrice } from "@/lib/format";
import { getYahooQuotes } from "@/lib/sources/yahoo";
import { getNews } from "@/lib/sources/rss";
import { STOCKS_WATCHLIST, US_INDICES } from "@/lib/watchlist";
import { InsightsList } from "@/components/InsightsList";

export const revalidate = 240;

export default async function StocksPage() {
  const now = new Date().toISOString();

  const [indices, watchlistQuotes, news] = await Promise.all([
    getYahooQuotes(US_INDICES.map((i) => i.symbol)),
    getYahooQuotes(STOCKS_WATCHLIST.map((w) => w.symbol)),
    getNews("internacional", 10),
  ]);

  const insights: string[] = [];

  for (const idx of US_INDICES) {
    const q = indices[idx.symbol];
    if (q && Math.abs(q.changePct) >= 1) {
      insights.push(`${idx.label} ${q.changePct >= 0 ? "sobe" : "cai"} ${formatPct(Math.abs(q.changePct)).replace("+", "")} — movimento direcional no mercado americano.`);
    }
  }

  for (const w of STOCKS_WATCHLIST) {
    const q = watchlistQuotes[w.symbol];
    if (q && Math.abs(q.changePct) >= 3) {
      insights.push(`${w.symbol} (watchlist) ${q.changePct >= 0 ? "dispara" : "despenca"} ${formatPct(Math.abs(q.changePct)).replace("+", "")} hoje.`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Stocks (EUA)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Dados reais via Yahoo Finance (sem chave de API). Análise fundamentalista por ativo na aba Fundamentalista.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {US_INDICES.map((idx) => {
          const q = indices[idx.symbol];
          return q ? (
            <StatCard key={idx.symbol} label={idx.label} value={formatPrice(q.price, q.currency)} changePct={q.changePct} />
          ) : null;
        })}
      </div>

      {insights.length > 0 && (
        <Panel title="Insights do Dia" updatedAt={now}>
          <InsightsList items={insights} defaultCount={15} />
        </Panel>
      )}

      <Panel title="Watchlist" updatedAt={now}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {STOCKS_WATCHLIST.map((w) => {
            const q = watchlistQuotes[w.symbol];
            return (
              <div key={w.symbol} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-sm font-medium text-text">{w.symbol}</div>
                  <div className="text-xs text-text-muted">{w.label}</div>
                </div>
                {q ? (
                  <div className="text-right">
                    <div className="text-sm text-text">{formatPrice(q.price, q.currency)}</div>
                    <div className={`text-xs ${changeColorClass(q.changePct)}`}>{formatPct(q.changePct)}</div>
                  </div>
                ) : (
                  <span className="text-xs text-down">indisponível</span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Notícias EUA" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
