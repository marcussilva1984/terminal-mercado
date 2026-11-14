import Link from "next/link";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { NewsFeed } from "@/components/NewsFeed";
import { CurrencyStrengthMeter } from "@/components/CurrencyStrengthMeter";
import { ZScoreHighlightList } from "@/components/ZScoreHighlightList";
import { changeColorClass, formatNumber, formatPct } from "@/lib/format";
import { getForexPairs, getCurrencyStrength, getDXY } from "@/lib/forexService";
import { getNews } from "@/lib/sources/rss";
import { getZScoreHighlights } from "@/lib/zscoreService";

export const revalidate = 240;

export default async function ForexPage() {
  const now = new Date().toISOString();

  const [pairsResult, strengthResult, dxyResult, news, zScoreResult] = await Promise.all([
    getForexPairs().catch(() => null),
    getCurrencyStrength().catch(() => null),
    getDXY().catch(() => null),
    getNews("forex", 10),
    getZScoreHighlights("forex").catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Forex</h1>
        <p className="mt-1 text-sm text-text-muted">
          Dados reais via Yahoo Finance (sem chave de API).{" "}
          <Link href="/forex/carteira" className="text-gold-bright hover:underline">
            → Minha Carteira Forex (corretoras)
          </Link>
          {" · "}
          <Link href="/forex/ideias" className="text-gold-bright hover:underline">
            → Ideias de Trading
          </Link>
          {" · "}
          <Link href="/macro" className="text-gold-bright hover:underline">
            → Juros, bancos centrais e calendário (Macro)
          </Link>
        </p>
      </div>

      {dxyResult && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Índice Dólar (DXY)" value={dxyResult.price.toFixed(2)} changePct={dxyResult.changePct} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Pares Principais (G8 + BRL)" updatedAt={now}>
          {pairsResult ? (
            <div className="flex flex-col divide-y divide-border/50">
              {pairsResult.map((p) => (
                <div key={p.pair} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-text">{p.pair}</div>
                    <div className="text-xs text-text-muted">{p.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-text">{formatNumber(p.price, p.price < 10 ? 4 : 2)}</div>
                    <div className={`text-xs ${changeColorClass(p.changePct)}`}>{formatPct(p.changePct)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Cache reduzido a 30s (Yahoo Finance, sem chave). Cotação de forex tem um delay natural
            pequeno da própria fonte gratuita — não existe API 100% real-time sem custo.
          </p>
        </Panel>

        <Panel title="Força das Moedas (G8)" updatedAt={now}>
          {strengthResult ? (
            <>
              <CurrencyStrengthMeter items={strengthResult} />
              <p className="mt-3 text-xs text-text-muted">
                Variação média de cada moeda contra a cesta das outras 7, no dia. Aproximação via
                pares vs. USD — não são 28 cruzamentos reais.
              </p>
            </>
          ) : (
            <p className="text-sm text-down">Fonte indisponível no momento.</p>
          )}
        </Panel>
      </div>

      <Panel title="Z-Score — Watchlist Forex" updatedAt={now}>
        {zScoreResult ? (
          <ZScoreHighlightList items={zScoreResult} />
        ) : (
          <p className="text-sm text-text-muted">
            Configure <code>DATABASE_URL</code> e rode o backfill para habilitar o z-score.
          </p>
        )}
      </Panel>

      <Panel title="Notícias Forex / Macro" updatedAt={now}>
        <NewsFeed items={news} now={now} />
      </Panel>
    </div>
  );
}
