import { Panel } from "@/components/Panel";
import { GrahamTable, BazinTable } from "@/components/ValuationTable";
import { Sma200Table, MonteCarloTable } from "@/components/Sma200Table";
import {
  getGrahamValuations,
  getBazinValuationsB3,
  getBazinValuationsFii,
  getSma200Signals,
  getMonteCarloRanges,
} from "@/lib/valuation";
import { B3_WATCHLIST, FII_WATCHLIST, STOCKS_WATCHLIST, CRIPTO_WATCHLIST } from "@/lib/watchlist";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

function dedupe(a: { symbol: string; label: string }[], b: { symbol: string; label: string }[]) {
  const merged = [...a, ...b];
  const seen = new Set<string>();
  return merged.filter((x) => {
    if (seen.has(x.symbol)) return false;
    seen.add(x.symbol);
    return true;
  });
}

export default async function OportunidadesPage() {
  const now = new Date().toISOString();

  const b3Watchlist = hasDatabase() ? dedupe(B3_WATCHLIST, await getWatchlist("b3").catch(() => [])) : B3_WATCHLIST;
  const fiiWatchlist = hasDatabase() ? dedupe(FII_WATCHLIST, await getWatchlist("fii").catch(() => [])) : FII_WATCHLIST;
  const stocksWatchlist = hasDatabase()
    ? dedupe(STOCKS_WATCHLIST, await getWatchlist("stocks").catch(() => []))
    : STOCKS_WATCHLIST;
  const criptoWatchlist = hasDatabase()
    ? dedupe(CRIPTO_WATCHLIST, await getWatchlist("cripto").catch(() => []))
    : CRIPTO_WATCHLIST;

  const trendItems = [
    ...b3Watchlist.map((w) => ({ ...w, assetClass: "b3" })),
    ...stocksWatchlist.map((w) => ({ ...w, assetClass: "stocks" })),
    ...criptoWatchlist.map((w) => ({ ...w, assetClass: "cripto" })),
  ];

  const [graham, bazinB3, bazinFii, sma200, monteCarlo] = await Promise.all([
    getGrahamValuations(b3Watchlist).catch(() => []),
    getBazinValuationsB3(b3Watchlist).catch(() => []),
    getBazinValuationsFii(fiiWatchlist).catch(() => []),
    getSma200Signals(trendItems).catch(() => []),
    getMonteCarloRanges(trendItems, 30, 2000).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Oportunidades</h1>
        <p className="mt-1 text-sm text-text-muted">
          Fórmulas e estatísticas clássicas aplicadas à sua watchlist — tudo calculado a partir de
          dado real (Fundamentus, Yahoo Finance), sem opinião ou recomendação embutida. Nenhuma
          tabela aqui é sugestão de compra/venda: são pontos de partida pra você investigar mais.
        </p>
      </div>

      <Panel title="Fórmula de Graham — Valor Justo (Ações B3)" updatedAt={now}>
        <GrahamTable items={graham} />
        <p className="mt-3 text-xs text-text-muted">
          Valor Justo = √(22,5 × LPA × VPA). Pensada por Graham pra empresas industriais estáveis —
          em papéis muito cíclicos ou ligados a commodities (petróleo, mineração), o resultado tende
          a distorcer bastante o preço real. Margem positiva = valor justo acima do preço atual.
        </p>
      </Panel>

      <Panel title="Método Décio Bazin — Preço Teto por Dividendos (Ações B3)" updatedAt={now}>
        <BazinTable items={bazinB3} />
        <p className="mt-3 text-xs text-text-muted">
          Preço Justo = dividendo médio anual / 6%. O Bazin original mirava um yield-alvo de 6% —
          num cenário de Selic mais alta que a de quando a fórmula foi criada, o "preço justo" tende
          a vir sistematicamente acima do preço de mercado pra qualquer bom pagador. Use como
          referência histórica, não como alvo absoluto.
        </p>
      </Panel>

      <Panel title="Método Décio Bazin — Preço Teto por Dividendos (FII)" updatedAt={now}>
        <BazinTable items={bazinFii} />
        <p className="mt-3 text-xs text-text-muted">
          Mesma fórmula, usando os proventos pagos nos últimos 12 meses via Fundamentus.
        </p>
      </Panel>

      <Panel title="Média Móvel de 200 Pregões (SMA200)" updatedAt={now}>
        <Sma200Table items={sma200} />
        <p className="mt-3 text-xs text-text-muted">
          Preço atual vs. a média dos últimos 200 fechamentos diários — o cruzamento de tendência de
          longo prazo mais usado no mercado. Cobre Ações B3, Stocks (EUA) e Cripto da sua watchlist.
        </p>
      </Panel>

      <Panel title="Monte Carlo — Faixa Provável de Preço (30 dias)" updatedAt={now}>
        <MonteCarloTable items={monteCarlo} />
        <p className="mt-3 text-xs text-text-muted">
          Simulação de 2.000 caminhos de preço a partir da volatilidade histórica (retornos diários)
          de cada ativo — mostra a faixa entre o 5º e o 95º percentil dos resultados simulados daqui
          a 30 dias. É uma leitura de dispersão estatística, não uma previsão de preço.
        </p>
      </Panel>
    </div>
  );
}
