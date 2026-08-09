import { Panel } from "@/components/Panel";
import { GrahamTable, BazinTable, DcfTable } from "@/components/ValuationTable";
import { Sma200Table, MonteCarloTable } from "@/components/Sma200Table";
import {
  getGrahamValuations,
  getBazinValuationsB3,
  getBazinValuationsFii,
  getSma200Signals,
  getMonteCarloRanges,
  matchFatosRelevantes,
  getDcfValuations,
} from "@/lib/valuation";
import { B3_WATCHLIST, FII_WATCHLIST, STOCKS_WATCHLIST, CRIPTO_WATCHLIST, FOREX_WATCHLIST } from "@/lib/watchlist";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";

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
  const forexWatchlist = hasDatabase()
    ? dedupe(FOREX_WATCHLIST, await getWatchlist("forex").catch(() => []))
    : FOREX_WATCHLIST;

  const trendItems = [
    ...b3Watchlist.map((w) => ({ ...w, assetClass: "b3" })),
    ...stocksWatchlist.map((w) => ({ ...w, assetClass: "stocks" })),
    ...criptoWatchlist.map((w) => ({ ...w, assetClass: "cripto" })),
    ...forexWatchlist.map((w) => ({ ...w, assetClass: "forex" })),
  ];
  // SMA200 e Monte Carlo entram também com FII — Bazin já cobre valuation por
  // dividendo, mas tendência/faixa de preço de longo prazo é uma leitura
  // diferente.
  const trendAndMonteCarloItems = [...trendItems, ...fiiWatchlist.map((w) => ({ ...w, assetClass: "fii" }))];

  // Horizonte de 3 anos (~756 pregões) pra casar com o perfil de longo prazo
  // do usuário — em compensação, reduz simulações (1000 em vez de 2000) pra
  // manter o custo de CPU razoável com o passo bem maior.
  const MONTE_CARLO_HORIZON_DAYS = 756;

  const [graham, bazinB3, bazinFii, sma200, monteCarlo, fatos, dcf] = await Promise.all([
    getGrahamValuations(b3Watchlist).catch(() => []),
    getBazinValuationsB3(b3Watchlist).catch(() => []),
    getBazinValuationsFii(fiiWatchlist).catch(() => []),
    getSma200Signals(trendAndMonteCarloItems).catch(() => []),
    getMonteCarloRanges(trendAndMonteCarloItems, MONTE_CARLO_HORIZON_DAYS, 1000).catch(() => []),
    getFatosRelevantes(60).catch(() => []),
    getDcfValuations(b3Watchlist).catch(() => []),
  ]);

  const fatosMatches = matchFatosRelevantes(b3Watchlist, fatos);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">Oportunidades</h1>
          <p className="mt-1 text-sm text-text-muted">
            Fórmulas e estatísticas clássicas aplicadas à sua watchlist — tudo calculado a partir de
            dado real (Fundamentus, Yahoo Finance), sem opinião ou recomendação embutida. Nenhuma
            tabela aqui é sugestão de compra/venda: são pontos de partida pra você investigar mais.
          </p>
        </div>
        <a
          href="/relatorio-oportunidades"
          className="shrink-0 rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
        >
          Relatório PDF
        </a>
      </div>

      {fatosMatches.length > 0 && (
        <Panel title="Fatos Relevantes recentes na sua watchlist B3" updatedAt={now}>
          <ul className="flex flex-col divide-y divide-border/50">
            {fatosMatches.map((m) => (
              <li key={m.symbol} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                <div>
                  <span className="font-medium text-text">{m.symbol}</span>{" "}
                  <span className="text-text-muted">— {m.subject}</span>
                </div>
                <a
                  href={m.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-gold-bright hover:underline"
                >
                  {m.date} ↗
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-muted">
            Cruzamento aproximado por nome da empresa (CVM) — ativos cadastrados sem um nome real
            (só o ticker) não entram aqui, já que não tem como casar com o nome legal da CVM.
          </p>
        </Panel>
      )}

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

      <Panel title="Fluxo de Caixa Descontado (DCF) — Ações B3" updatedAt={now}>
        <DcfTable items={dcf} />
        <p className="mt-3 text-xs text-text-muted">
          Valor Justo = fluxo de caixa livre (Caixa Operacional + Caixa de Investimento, do
          demonstrativo oficial da CVM, último ano fiscal completo) projetado 5 anos a 3% a.a.,
          descontado a 12% a.a., mais valor terminal (crescimento perpétuo de 3%), menos dívida
          líquida, dividido pelo número de ações. As taxas de crescimento e desconto são premissas
          fixas e genéricas, não específicas de cada empresa — mudar essas duas taxas muda bastante
          o resultado, então trate como ponto de partida, não como número definitivo. Funciona mal
          pra bancos/financeiras (o fluxo de investimento delas é carteira de crédito, não capex) e
          pra empresas com fluxo de caixa livre negativo no último ano fiscal, que ficam de fora.
          Atenção: é o fluxo de caixa de UM ano só (o mais recente reportado) — variação de capital
          de giro ou eventos não recorrentes num único ano podem inflar o número e distorcer bastante
          o valor justo pra cima ou pra baixo. Vale conferir o histórico de anos anteriores da empresa
          antes de confiar num resultado que pareça exagerado.
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
          longo prazo mais usado no mercado. Cobre Ações B3, FII, Stocks (EUA), Cripto e Forex da sua
          watchlist.
        </p>
      </Panel>

      <Panel title="Monte Carlo — Faixa Provável de Preço (3 anos)" updatedAt={now}>
        <MonteCarloTable items={monteCarlo} />
        <p className="mt-3 text-xs text-text-muted">
          Simulação de 1.000 caminhos de preço a partir da volatilidade histórica (retornos diários,
          ~2 anos de dado) de cada ativo — mostra a faixa entre o 5º e o 95º percentil daqui a 3 anos.
          Cobre Ações B3, FII, Stocks, Cripto e Forex. Importante: num horizonte assim mais longo essa
          faixa fica naturalmente MUITO larga — o modelo assume a mesma volatilidade histórica se
          repetindo linearmente, sem reversão à média nem mudança de regime, então é uma leitura de
          dispersão estatística (quanto o ativo já balançou no passado), não uma previsão de preço.
        </p>
      </Panel>
    </div>
  );
}
