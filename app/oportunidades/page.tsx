import { Panel } from "@/components/Panel";
import { GrahamTable, BazinTable, DcfTable } from "@/components/ValuationTable";
import { Sma200Table, MonteCarloTable, RsiTable, BollingerTable } from "@/components/Sma200Table";
import { OportunidadesSearchForm } from "@/components/OportunidadesSearchForm";
import {
  getGrahamValuations,
  getBazinValuationsB3,
  getBazinValuationsFii,
  getSma200Signals,
  getMonteCarloRanges,
  getRsiSignals,
  getBollingerSignals,
  matchFatosRelevantes,
  getDcfValuations,
} from "@/lib/valuation";
import { getFatosRelevantes } from "@/lib/sources/cvmFatosRelevantes";

export const dynamic = "force-dynamic";

const VALID_CLASSES = ["b3", "fii", "stocks", "cripto", "forex"];

export default async function OportunidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; assetClass?: string }>;
}) {
  const { symbol: rawSymbol, assetClass: rawClass } = await searchParams;
  const symbol = rawSymbol?.trim().toUpperCase();
  const assetClass = VALID_CLASSES.includes(rawClass ?? "") ? (rawClass as string) : "b3";
  const now = new Date().toISOString();

  const intro = (
    <div>
      <h1 className="text-xl font-semibold text-text">Oportunidades</h1>
      <p className="mt-1 text-sm text-text-muted">
        Digite um ativo pra ver as fórmulas de valuation calculadas na hora, com dado real — sem
        opinião ou recomendação embutida. Antes essa aba calculava tudo pra watchlist inteira de
        uma vez (lento); agora é sob demanda, só pro ativo que você pedir.
      </p>
    </div>
  );

  if (!symbol) {
    return (
      <div className="flex flex-col gap-6">
        {intro}
        <Panel title="Buscar Ativo">
          <OportunidadesSearchForm />
        </Panel>
      </div>
    );
  }

  const target = [{ symbol, label: symbol }];
  const targetWithClass = [{ symbol, label: symbol, assetClass }];
  const isB3 = assetClass === "b3";
  const isFii = assetClass === "fii";

  const [graham, bazinB3, bazinFii, sma200, monteCarlo, rsi, bollinger, fatos] = await Promise.all([
    isB3 ? getGrahamValuations(target).catch(() => []) : Promise.resolve([]),
    isB3 ? getBazinValuationsB3(target).catch(() => []) : Promise.resolve([]),
    isFii ? getBazinValuationsFii(target).catch(() => []) : Promise.resolve([]),
    getSma200Signals(targetWithClass).catch(() => []),
    getMonteCarloRanges(targetWithClass, 756, 1000).catch(() => []),
    getRsiSignals(targetWithClass).catch(() => []),
    getBollingerSignals(targetWithClass).catch(() => []),
    isB3 ? getFatosRelevantes(60).catch(() => []) : Promise.resolve([]),
  ]);

  const fatosMatches = isB3 ? matchFatosRelevantes(target, fatos) : [];
  const nothingFound =
    graham.length === 0 &&
    bazinB3.length === 0 &&
    bazinFii.length === 0 &&
    sma200.length === 0 &&
    monteCarlo.length === 0 &&
    rsi.length === 0 &&
    bollinger.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {intro}
      <Panel title="Buscar Ativo">
        <OportunidadesSearchForm symbol={symbol} assetClass={assetClass} />
      </Panel>

      {nothingFound && (
        <Panel title={`Sem dado suficiente pra ${symbol}`} updatedAt={now}>
          <p className="text-sm text-text-muted">
            Não achei nenhum resultado pra {symbol} ({assetClass}) — pode ser símbolo incorreto,
            classe errada, ou fonte sem dado suficiente pra esse ativo específico (ex.: LPA/VPA
            negativo, sem 200 pregões de histórico, empresa recém-listada etc.).
          </p>
        </Panel>
      )}

      {fatosMatches.length > 0 && (
        <Panel title="Fatos Relevantes recentes" updatedAt={now}>
          <ul className="flex flex-col divide-y divide-border/50">
            {fatosMatches.map((m) => (
              <li key={m.symbol} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                <span className="text-text-muted">{m.subject}</span>
                <a href={m.documentUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-gold-bright hover:underline">
                  {m.date} ↗
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {graham.length > 0 && (
        <Panel title="Fórmula de Graham — Valor Justo" updatedAt={now}>
          <GrahamTable items={graham} />
          <p className="mt-3 text-xs text-text-muted">
            Valor Justo = √(22,5 × LPA × VPA). Pensada por Graham pra empresas industriais
            estáveis — em papéis muito cíclicos ou ligados a commodities, o resultado tende a
            distorcer bastante o preço real.
          </p>
        </Panel>
      )}

      {bazinB3.length > 0 && (
        <Panel title="Método Décio Bazin — Preço Teto por Dividendos" updatedAt={now}>
          <BazinTable items={bazinB3} />
          <p className="mt-3 text-xs text-text-muted">
            Preço Justo = dividendo médio anual / 6%. Num cenário de Selic mais alta que a de
            quando a fórmula foi criada, o "preço justo" tende a vir sistematicamente acima do
            preço de mercado.
          </p>
        </Panel>
      )}

      {bazinFii.length > 0 && (
        <Panel title="Método Décio Bazin — Preço Teto por Dividendos (FII)" updatedAt={now}>
          <BazinTable items={bazinFii} />
          <p className="mt-3 text-xs text-text-muted">
            Mesma fórmula, usando os proventos pagos nos últimos 12 meses via Fundamentus.
          </p>
        </Panel>
      )}

      {isB3 && (
        <DcfSection symbol={symbol} now={now} />
      )}

      {sma200.length > 0 && (
        <Panel title="Média Móvel de 200 Pregões (SMA200)" updatedAt={now}>
          <Sma200Table items={sma200} />
          <p className="mt-3 text-xs text-text-muted">
            Preço atual vs. a média dos últimos 200 fechamentos diários — cruzamento de tendência
            de longo prazo.
          </p>
        </Panel>
      )}

      {rsi.length > 0 && (
        <Panel title="RSI — Índice de Força Relativa" updatedAt={now}>
          <RsiTable items={rsi} />
          <p className="mt-3 text-xs text-text-muted">
            Janela de 21 pregões (~1 mês), mais longa que o padrão de manual técnico (14) — leitura
            de médio/longo prazo, não de swing trade. Acima de 70 = historicamente sobrecomprado;
            abaixo de 30 = sobrevendido. Não é sinal de compra/venda isolado, é um dado a mais.
          </p>
        </Panel>
      )}

      {bollinger.length > 0 && (
        <Panel title="Bandas de Bollinger" updatedAt={now}>
          <BollingerTable items={bollinger} />
          <p className="mt-3 text-xs text-text-muted">
            Janela de 50 pregões (~2 meses e meio), mais longa que o padrão (20) pelo mesmo motivo
            do RSI acima. Posição mostra onde o preço está dentro da banda (±2 desvios-padrão da
            média): 0% = na banda inferior, 100% = na banda superior — pode passar desses limites
            em movimento forte.
          </p>
        </Panel>
      )}

      {monteCarlo.length > 0 && (
        <Panel title="Monte Carlo — Faixa Provável de Preço (3 anos)" updatedAt={now}>
          <MonteCarloTable items={monteCarlo} />
          <p className="mt-3 text-xs text-text-muted">
            Simulação de 1.000 caminhos de preço a partir da volatilidade histórica — mostra a
            faixa entre o 5º e o 95º percentil daqui a 3 anos. Num horizonte assim mais longo essa
            faixa fica naturalmente MUITO larga; é uma leitura de dispersão estatística, não uma
            previsão de preço.
          </p>
        </Panel>
      )}
    </div>
  );
}

// Isolado num componente à parte só pra manter o fetch do DCF fora do
// Promise.all principal — ele é o mais pesado dos 5 (CVM + Fundamentus) e só
// se aplica a B3, sem motivo de atrasar os outros painéis.
async function DcfSection({ symbol, now }: { symbol: string; now: string }) {
  const dcf = await getDcfValuations([{ symbol, label: symbol }]).catch(() => []);
  if (dcf.length === 0) return null;

  return (
    <Panel title="Fluxo de Caixa Descontado (DCF)" updatedAt={now}>
      <DcfTable items={dcf} />
      <p className="mt-3 text-xs text-text-muted">
        Valor Justo = fluxo de caixa livre (Caixa Operacional + Caixa de Investimento, do
        demonstrativo oficial da CVM, último ano fiscal completo) projetado 5 anos a 3% a.a.,
        descontado a 12% a.a., mais valor terminal (crescimento perpétuo de 3%), menos dívida
        líquida, dividido pelo número de ações. Taxas fixas e genéricas — mudar essas duas taxas
        muda bastante o resultado. Funciona mal pra bancos/financeiras e pra empresas com fluxo de
        caixa livre negativo no último ano fiscal. É o fluxo de caixa de UM ano só — variação de
        capital de giro ou eventos não recorrentes podem distorcer bastante o valor justo.
      </p>
    </Panel>
  );
}
