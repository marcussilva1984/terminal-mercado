import { getFullIndicators, getFiiDividendHistory } from "@/lib/sources/fundamentus";
import { getYahooQuote } from "@/lib/sources/yahoo";
import { fetchCandles } from "@/lib/sources/yahooTickerDetail";
import { getAnnualCashFlow } from "@/lib/sources/cvmFinancials";

function parseBRNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, "").replace(",", ".").replace("%", "").trim();
  const v = parseFloat(cleaned);
  return Number.isNaN(v) ? null : v;
}

function toYahooSymbol(symbol: string, assetClass: string): string {
  if (assetClass === "b3" || assetClass === "fii") return `${symbol}.SA`;
  if (assetClass === "cripto") return `${symbol}-USD`;
  if (assetClass === "forex") return `${symbol}=X`;
  return symbol;
}

function findValue(sections: { items: { label: string; value: string }[] }[], label: string): string | null {
  for (const s of sections) {
    const item = s.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return null;
}

export interface GrahamResult {
  symbol: string;
  label: string;
  price: number;
  eps: number; // LPA
  bookValuePerShare: number; // VPA
  fairValue: number;
  marginOfSafetyPct: number; // (fairValue - price) / price * 100
}

export interface BazinResult {
  symbol: string;
  label: string;
  price: number;
  avgAnnualDividendPerShare: number;
  fairPrice: number;
  marginOfSafetyPct: number;
}

// Fórmula de Graham: valor justo = √(22.5 × LPA × VPA). Pensada originalmente
// pra empresas industriais estáveis — em papéis cíclicos/commodities (ex.:
// petróleo, mineração) o resultado tende a ficar bem acima do preço de
// mercado; não é erro do cálculo, é limitação conhecida da fórmula.
export async function getGrahamValuations(symbols: { symbol: string; label: string }[]): Promise<GrahamResult[]> {
  const results = await Promise.allSettled(
    symbols.map(async ({ symbol, label }) => {
      const sections = await getFullIndicators(symbol);
      const priceRaw = findValue(sections, "Cotação");
      const epsRaw = findValue(sections, "LPA");
      const bvpsRaw = findValue(sections, "VPA");
      const price = priceRaw ? parseBRNumber(priceRaw) : null;
      const eps = epsRaw ? parseBRNumber(epsRaw) : null;
      const bvps = bvpsRaw ? parseBRNumber(bvpsRaw) : null;
      if (!price || !eps || !bvps || eps <= 0 || bvps <= 0) return null;

      const fairValue = Math.sqrt(22.5 * eps * bvps);
      const marginOfSafetyPct = ((fairValue - price) / price) * 100;
      return { symbol, label, price, eps, bookValuePerShare: bvps, fairValue, marginOfSafetyPct };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<GrahamResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is GrahamResult => v !== null)
    .sort((a, b) => b.marginOfSafetyPct - a.marginOfSafetyPct);
}

// Método Décio Bazin: preço justo = dividendo médio anual por ação / 6%.
// Usa o Div. Yield já calculado pelo Fundamentus (últimos 12 meses) pra achar
// o dividendo/ação implícito, em vez de somar pagamento por pagamento.
export async function getBazinValuationsB3(symbols: { symbol: string; label: string }[]): Promise<BazinResult[]> {
  const results = await Promise.allSettled(
    symbols.map(async ({ symbol, label }) => {
      const sections = await getFullIndicators(symbol);
      const priceRaw = findValue(sections, "Cotação");
      const dyRaw = findValue(sections, "Div. Yield");
      const price = priceRaw ? parseBRNumber(priceRaw) : null;
      const dyPct = dyRaw ? parseBRNumber(dyRaw) : null;
      if (!price || !dyPct || dyPct <= 0) return null;

      const avgAnnualDividendPerShare = (dyPct / 100) * price;
      const fairPrice = avgAnnualDividendPerShare / 0.06;
      const marginOfSafetyPct = ((fairPrice - price) / price) * 100;
      return { symbol, label, price, avgAnnualDividendPerShare, fairPrice, marginOfSafetyPct };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<BazinResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is BazinResult => v !== null)
    .sort((a, b) => b.marginOfSafetyPct - a.marginOfSafetyPct);
}

// Mesma lógica do Bazin, mas pra FII: soma os proventos pagos nos últimos 12
// meses (Fundamentus não tem Div. Yield estruturado pra FII do mesmo jeito),
// contra o preço atual via Yahoo.
export async function getBazinValuationsFii(symbols: { symbol: string; label: string }[]): Promise<BazinResult[]> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const sinceIso = oneYearAgo.toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    symbols.map(async ({ symbol, label }) => {
      const [payments, quote] = await Promise.all([
        getFiiDividendHistory(symbol),
        getYahooQuote(`${symbol}.SA`),
      ]);
      if (!quote) return null;

      const avgAnnualDividendPerShare = payments
        .filter((p) => p.date >= sinceIso)
        .reduce((sum, p) => sum + p.valuePerShare, 0);
      if (avgAnnualDividendPerShare <= 0) return null;

      const fairPrice = avgAnnualDividendPerShare / 0.06;
      const marginOfSafetyPct = ((fairPrice - quote.price) / quote.price) * 100;
      return { symbol, label, price: quote.price, avgAnnualDividendPerShare, fairPrice, marginOfSafetyPct };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<BazinResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is BazinResult => v !== null)
    .sort((a, b) => b.marginOfSafetyPct - a.marginOfSafetyPct);
}

export interface Sma200Result {
  symbol: string;
  label: string;
  assetClass: string;
  price: number;
  sma200: number;
  distancePct: number; // (price - sma200) / sma200 * 100
  trend: "acima" | "abaixo";
}

// Preço atual vs. média móvel simples dos últimos 200 pregões — o cruzamento
// clássico de tendência de longo prazo (mesma convenção já usada no z-score
// de Forex). Precisa de pelo menos 200 candles pra ser confiável; se o ativo
// tiver histórico mais curto (IPO recente), pula.
export async function getSma200Signals(
  items: { symbol: string; label: string; assetClass: string }[]
): Promise<Sma200Result[]> {
  const results = await Promise.allSettled(
    items.map(async ({ symbol, label, assetClass }) => {
      const yahooSymbol = toYahooSymbol(symbol, assetClass);
      const candles = await fetchCandles(yahooSymbol, "1d");
      if (candles.length < 200) return null;

      const last200 = candles.slice(-200);
      const sma200 = last200.reduce((sum, c) => sum + c.close, 0) / last200.length;
      const price = candles[candles.length - 1].close;
      const distancePct = ((price - sma200) / sma200) * 100;

      return { symbol, label, assetClass, price, sma200, distancePct, trend: (price >= sma200 ? "acima" : "abaixo") as "acima" | "abaixo" };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Sma200Result | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is Sma200Result => v !== null)
    .sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));
}

export interface MonteCarloResult {
  symbol: string;
  label: string;
  assetClass: string;
  price: number;
  horizonDays: number;
  p5: number;
  p50: number;
  p95: number;
}

// Simulação de Monte Carlo (movimento geométrico browniano) a partir da
// média/desvio dos retornos diários históricos — devolve uma FAIXA provável
// de preço daqui a `horizonDays`, não uma previsão. É estatística de
// distribuição: quanto mais volátil o ativo, mais larga a faixa.
export async function getMonteCarloRanges(
  items: { symbol: string; label: string; assetClass: string }[],
  horizonDays = 30,
  simulations = 2000
): Promise<MonteCarloResult[]> {
  const results = await Promise.allSettled(
    items.map(async ({ symbol, label, assetClass }) => {
      const yahooSymbol = toYahooSymbol(symbol, assetClass);
      const candles = await fetchCandles(yahooSymbol, "1d");
      if (candles.length < 30) return null;

      const closes = candles.map((c) => c.close);
      const logReturns: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        logReturns.push(Math.log(closes[i] / closes[i - 1]));
      }
      const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
      const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (logReturns.length - 1);
      const stdDev = Math.sqrt(variance);

      const price = closes[closes.length - 1];
      const finalPrices: number[] = [];
      for (let s = 0; s < simulations; s++) {
        let cumulative = 0;
        for (let d = 0; d < horizonDays; d++) {
          // Box-Muller pra gerar um retorno diário normal a partir de dois
          // uniformes — sem depender de RNG normal externo.
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          cumulative += mean + stdDev * z;
        }
        finalPrices.push(price * Math.exp(cumulative));
      }
      finalPrices.sort((a, b) => a - b);
      const pct = (p: number) => finalPrices[Math.floor((p / 100) * finalPrices.length)];

      return { symbol, label, assetClass, price, horizonDays, p5: pct(5), p50: pct(50), p95: pct(95) };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<MonteCarloResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is MonteCarloResult => v !== null);
}

export interface FatoRelevanteMatch {
  symbol: string;
  label: string;
  subject: string;
  date: string;
  documentUrl: string;
}

function normalizeCompanyText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

// Nome da empresa na watchlist (ex.: "Petrobras PN") -> primeira palavra
// significativa (ex.: "PETROBRAS"), removendo sufixo de tipo de ação. Ativos
// cadastrados sem nome (label = próprio ticker) não têm como casar contra o
// nome legal usado pela CVM — não é erro, só não dá pra cruzar sem nome real.
function coreCompanyToken(label: string): string | null {
  const cleaned = normalizeCompanyText(label).replace(/\b(ON|PN|PNA|PNB|PNC|UNIT|S\.?A\.?)\b/g, "").trim();
  const token = cleaned.split(/\s+/)[0] ?? "";
  return token.length >= 4 ? token : null;
}

// Cruza fatos relevantes recentes (CVM) com a watchlist de B3 pelo nome da
// empresa — aproximado por substring, não é um cadastro CNPJ->ticker
// oficial. Pode deixar de casar (falso negativo) quando o ativo foi
// cadastrado sem nome, mas não deve gerar falso positivo grosseiro (exige
// pelo menos 4 letras do nome real batendo).
export function matchFatosRelevantes(
  watchlist: { symbol: string; label: string }[],
  fatos: { companyName: string; date: string; subject: string; documentUrl: string }[]
): FatoRelevanteMatch[] {
  const matches: FatoRelevanteMatch[] = [];
  for (const w of watchlist) {
    const token = coreCompanyToken(w.label);
    if (!token) continue;
    const hit = fatos.find((f) => normalizeCompanyText(f.companyName).includes(token));
    if (hit) {
      matches.push({ symbol: w.symbol, label: w.label, subject: hit.subject, date: hit.date, documentUrl: hit.documentUrl });
    }
  }
  return matches;
}

export interface DcfResult {
  symbol: string;
  label: string;
  price: number;
  freeCashFlow: number; // R$ absoluto, ano fiscal mais recente (CVM)
  fiscalYear: string;
  fairValue: number;
  marginOfSafetyPct: number;
}

// Premissas fixas e genéricas — NÃO são específicas de cada empresa, é o
// maior limitador honesto desse modelo. Mudar essas duas linhas muda o
// resultado bastante; tratar como ponto de partida pra sensibilidade, não
// como verdade.
const DCF_GROWTH_RATE = 0.03; // crescimento do FCF projetado, 5 anos
const DCF_TERMINAL_GROWTH = 0.03; // crescimento perpétuo (valor terminal)
const DCF_WACC = 0.12; // taxa de desconto
const DCF_PROJECTION_YEARS = 5;

// DCF simplificado: FCF = Caixa Operacional + Caixa de Investimento (DFC
// oficial da CVM, ano fiscal mais recente) projetado a uma taxa de
// crescimento fixa por 5 anos, descontado a uma WACC fixa, mais valor
// terminal (Gordon Growth) — menos Dívida Líquida, dividido pelo número de
// ações (Fundamentus). Funciona mal pra bancos/financeiras (fluxo de caixa
// de investimento tem outra natureza lá — carteira de crédito, não capex) e
// pra empresas com FCF negativo no último ano fiscal (não dá pra projetar a
// partir de uma base negativa de forma confiável).
export async function getDcfValuations(symbols: { symbol: string; label: string }[]): Promise<DcfResult[]> {
  const results = await Promise.allSettled(
    symbols.map(async ({ symbol, label }) => {
      const [cf, sections] = await Promise.all([getAnnualCashFlow(symbol), getFullIndicators(symbol)]);
      if (!cf || cf.freeCashFlow <= 0) return null;

      const priceRaw = findValue(sections, "Cotação");
      const netDebtRaw = findValue(sections, "Dív. Líquida");
      const sharesRaw = findValue(sections, "Nro. Ações");
      const price = priceRaw ? parseBRNumber(priceRaw) : null;
      const netDebt = netDebtRaw ? parseBRNumber(netDebtRaw) : null;
      const shares = sharesRaw ? parseBRNumber(sharesRaw) : null;
      if (!price || netDebt === null || !shares || shares <= 0) return null;

      const fcf0 = cf.freeCashFlow * 1000; // CVM vem em milhares de R$

      let enterpriseValue = 0;
      let fcfT = fcf0;
      for (let t = 1; t <= DCF_PROJECTION_YEARS; t++) {
        fcfT *= 1 + DCF_GROWTH_RATE;
        enterpriseValue += fcfT / (1 + DCF_WACC) ** t;
      }
      const terminalValue = (fcfT * (1 + DCF_TERMINAL_GROWTH)) / (DCF_WACC - DCF_TERMINAL_GROWTH);
      enterpriseValue += terminalValue / (1 + DCF_WACC) ** DCF_PROJECTION_YEARS;

      const equityValue = enterpriseValue - netDebt;
      const fairValue = equityValue / shares;
      const marginOfSafetyPct = ((fairValue - price) / price) * 100;

      return {
        symbol,
        label,
        price,
        freeCashFlow: fcf0,
        fiscalYear: cf.fiscalYear,
        fairValue,
        marginOfSafetyPct,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<DcfResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is DcfResult => v !== null)
    .sort((a, b) => b.marginOfSafetyPct - a.marginOfSafetyPct);
}
