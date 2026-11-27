import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";
// Página de detalhe de ativo (B3/Stocks/FII/Cripto) — usa o mesmo fluxo de
// crumb já validado em yahooAnalyst.ts. Cobertura de analistas existe pra B3
// (papéis líquidos) e Stocks; FII e Cripto não têm cobertura de analistas
// (natural — fundos e cripto não são cobertos por equity research), mas
// preço/gráfico/dividendo funcionam igual.
let cachedCrumb: { crumb: string; cookie: string } | null = null;

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb) return cachedCrumb;
  const cookieRes = await fetch("https://fc.yahoo.com", { headers: { "user-agent": BROWSER_USER_AGENT } });
  const cookie = cookieRes.headers.get("set-cookie") ?? "";
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "user-agent": BROWSER_USER_AGENT, cookie },
  });
  const crumb = await crumbRes.text();
  cachedCrumb = { crumb, cookie };
  return cachedCrumb;
}

export interface UpgradeDowngrade {
  date: string; // ISO
  firm: string;
  toGrade: string;
  fromGrade: string;
  action: string;
  priceTargetAction: string;
  currentPriceTarget: number | null;
  priorPriceTarget: number | null;
}

export interface AnnualPoint {
  year: number;
  value: number;
}

export interface TickerDetail {
  symbol: string;
  shortName: string | null;
  currency: string | null;
  price: number | null;
  changePct: number | null;
  // Valuation
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  beta: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  evToRevenue: number | null;
  evToEbitda: number | null;
  trailingEps: number | null;      // LPA
  bookValuePerShare: number | null; // VPA
  // Eficiência / Margens
  grossMargins: number | null;      // Marg. Bruta
  ebitdaMargins: number | null;     // Marg. EBITDA
  operatingMargins: number | null;  // Marg. EBIT
  profitMargin: number | null;      // Marg. Líquida
  // Rentabilidade
  returnOnEquity: number | null;    // ROE
  returnOnAssets: number | null;    // ROA
  // Endividamento / Liquidez
  debtToEquity: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  currentRatio: number | null;      // Liquidez Corrente
  quickRatio: number | null;        // Liquidez Seca
  // Caixa
  ebitda: number | null;
  operatingCashflow: number | null; // FCO
  freeCashflow: number | null;      // FCF
  // Crescimento
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  // Faixas de preço
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  // Ações
  floatShares: number | null;
  sharesOutstanding: number | null;
  freeFloatPct: number | null;
  // Analistas
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  numberOfAnalysts: number | null;
  recommendationMean: number | null;
  upgradeHistory: UpgradeDowngrade[];
  // Calendário
  nextEarningsDate: string | null;
  exDividendDate: string | null;
  // Histórico anual (últimos 4–5 anos)
  annualRevenue: AnnualPoint[];
  annualNetIncome: AnnualPoint[];
  annualEbitda: AnnualPoint[];
  annualFreeCashflow: AnnualPoint[];
  annualEquity: AnnualPoint[];
  annualTotalDebt: AnnualPoint[];
}

export interface CandlePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartInterval = "1d" | "1wk" | "1mo";

const RANGE_BY_INTERVAL: Record<ChartInterval, string> = {
  "1d": "2y", // ~500 pregões — dá pra calcular SMA200 com folga
  "1wk": "5y",
  "1mo": "max",
};

export async function fetchCandles(symbol: string, interval: ChartInterval = "1d"): Promise<CandlePoint[]> {
  const range = RANGE_BY_INTERVAL[interval];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { "user-agent": BROWSER_USER_AGENT }, next: { revalidate: 15 * 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0] ?? {};
  const opens: (number | null)[] = quote.open ?? [];
  const highs: (number | null)[] = quote.high ?? [];
  const lows: (number | null)[] = quote.low ?? [];
  const closes: (number | null)[] = quote.close ?? [];
  const volumes: (number | null)[] = quote.volume ?? [];

  return timestamps
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i],
      volume: volumes[i],
    }))
    .filter(
      (p): p is CandlePoint =>
        // Yahoo às vezes retorna o período corrente (ainda em formação) com
        // preço 0/negativo antes de fechar — isso quebrava a escala do
        // gráfico inteiro (virava um "crash pra zero" falso na última vela).
        typeof p.open === "number" &&
        typeof p.high === "number" &&
        typeof p.low === "number" &&
        typeof p.close === "number" &&
        p.open > 0 &&
        p.high > 0 &&
        p.low > 0 &&
        p.close > 0
    )
    .map((p) => ({ ...p, volume: p.volume ?? 0 }));
}

export async function getTickerDetail(symbol: string): Promise<TickerDetail | null> {
  try {
    const { crumb, cookie } = await getCrumb();
    const modules = "summaryDetail,defaultKeyStatistics,financialData,upgradeDowngradeHistory,price,calendarEvents,incomeStatementHistory,cashflowStatementHistory,balanceSheetHistory";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

    const summaryRes = await fetch(url, { headers: { "user-agent": BROWSER_USER_AGENT, cookie }, next: { revalidate: 30 * 60 } });

    if (!summaryRes.ok) return null;
    const json = await summaryRes.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const price = result.price;
    const summaryDetail = result.summaryDetail ?? {};
    const keyStats = result.defaultKeyStatistics ?? {};
    const financialData = result.financialData ?? {};
    const calendarEvents = result.calendarEvents ?? {};
    const earningsDateRaw = calendarEvents.earnings?.earningsDate?.[0]?.raw;
    const exDividendRaw = calendarEvents.exDividendDate?.raw;
    const floatShares: number | null = keyStats.floatShares?.raw ?? null;
    const sharesOutstanding: number | null = keyStats.sharesOutstanding?.raw ?? null;
    const rawFreeFloatPct =
      floatShares !== null && sharesOutstanding ? (floatShares / sharesOutstanding) * 100 : null;
    const freeFloatPct = rawFreeFloatPct !== null && rawFreeFloatPct <= 100 ? rawFreeFloatPct : null;
    const upgradeHistory: UpgradeDowngrade[] = (result.upgradeDowngradeHistory?.history ?? [])
      .slice(0, 15)
      .map((h: Record<string, number | string>) => ({
        date: new Date(Number(h.epochGradeDate) * 1000).toISOString().slice(0, 10),
        firm: h.firm,
        toGrade: h.toGrade,
        fromGrade: h.fromGrade,
        action: h.action,
        priceTargetAction: h.priceTargetAction,
        currentPriceTarget: typeof h.currentPriceTarget === "number" ? h.currentPriceTarget : null,
        priorPriceTarget: typeof h.priorPriceTarget === "number" ? h.priorPriceTarget : null,
      }));

    // Histórico anual: incomeStatement, cashflow, balanceSheet
    function toAnnualPoints(statements: Record<string, { raw?: number }>[], field: string): AnnualPoint[] {
      return statements
        .map((s) => {
          const endDateRaw = (s.endDate as { raw?: number })?.raw;
          const val = (s[field] as { raw?: number })?.raw;
          if (!endDateRaw || val == null) return null;
          return { year: new Date(endDateRaw * 1000).getFullYear(), value: val };
        })
        .filter((p): p is AnnualPoint => p !== null)
        .sort((a, b) => a.year - b.year);
    }

    const incomeStmts: Record<string, { raw?: number }>[] =
      result.incomeStatementHistory?.incomeStatementHistory ?? [];
    const cashflowStmts: Record<string, { raw?: number }>[] =
      result.cashflowStatementHistory?.cashflowStatements ?? [];
    const balanceStmts: Record<string, { raw?: number }>[] =
      result.balanceSheetHistory?.balanceSheetStatements ?? [];

    const annualEbitda = toAnnualPoints(incomeStmts, "ebitda").length > 0
      ? toAnnualPoints(incomeStmts, "ebitda")
      : toAnnualPoints(cashflowStmts, "totalCashFromOperatingActivities").map((p) => ({ year: p.year, value: p.value })); // fallback FCO

    return {
      symbol,
      shortName: price?.shortName ?? null,
      currency: price?.currency ?? null,
      price: price?.regularMarketPrice?.raw ?? null,
      changePct: price?.regularMarketChangePercent?.raw != null ? price.regularMarketChangePercent.raw * 100 : null,
      // Valuation
      trailingPE: summaryDetail.trailingPE?.raw ?? null,
      forwardPE: summaryDetail.forwardPE?.raw ?? null,
      priceToBook: keyStats.priceToBook?.raw ?? null,
      dividendYield: summaryDetail.dividendYield?.raw != null ? summaryDetail.dividendYield.raw * 100 : null,
      beta: summaryDetail.beta?.raw ?? null,
      marketCap: summaryDetail.marketCap?.raw ?? null,
      enterpriseValue: keyStats.enterpriseValue?.raw ?? null,
      evToRevenue: keyStats.enterpriseToRevenue?.raw ?? null,
      evToEbitda: keyStats.enterpriseToEbitda?.raw ?? null,
      trailingEps: keyStats.trailingEps?.raw ?? null,
      bookValuePerShare: keyStats.bookValue?.raw ?? null,
      // Margens
      grossMargins: financialData.grossMargins?.raw != null ? financialData.grossMargins.raw * 100 : null,
      ebitdaMargins: financialData.ebitdaMargins?.raw != null ? financialData.ebitdaMargins.raw * 100 : null,
      operatingMargins: financialData.operatingMargins?.raw != null ? financialData.operatingMargins.raw * 100 : null,
      profitMargin: financialData.profitMargins?.raw != null ? financialData.profitMargins.raw * 100 : null,
      // Rentabilidade
      returnOnEquity: financialData.returnOnEquity?.raw != null ? financialData.returnOnEquity.raw * 100 : null,
      returnOnAssets: financialData.returnOnAssets?.raw != null ? financialData.returnOnAssets.raw * 100 : null,
      // Endividamento / Liquidez
      debtToEquity: financialData.debtToEquity?.raw ?? null,
      totalDebt: financialData.totalDebt?.raw ?? null,
      totalCash: financialData.totalCash?.raw ?? null,
      currentRatio: financialData.currentRatio?.raw ?? null,
      quickRatio: financialData.quickRatio?.raw ?? null,
      // Caixa / Resultado
      ebitda: financialData.ebitda?.raw ?? null,
      operatingCashflow: financialData.operatingCashflow?.raw ?? null,
      freeCashflow: financialData.freeCashflow?.raw ?? null,
      // Crescimento
      revenueGrowth: financialData.revenueGrowth?.raw != null ? financialData.revenueGrowth.raw * 100 : null,
      earningsGrowth: financialData.earningsGrowth?.raw != null ? financialData.earningsGrowth.raw * 100 : null,
      // Faixa de preço
      fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow?.raw ?? null,
      fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw ?? null,
      // Ações
      floatShares,
      sharesOutstanding,
      freeFloatPct,
      // Analistas
      targetMeanPrice: financialData.targetMeanPrice?.raw ?? null,
      targetHighPrice: financialData.targetHighPrice?.raw ?? null,
      targetLowPrice: financialData.targetLowPrice?.raw ?? null,
      numberOfAnalysts: financialData.numberOfAnalystOpinions?.raw ?? null,
      recommendationMean: financialData.recommendationMean?.raw ?? null,
      upgradeHistory,
      // Calendário
      nextEarningsDate: typeof earningsDateRaw === "number" ? new Date(earningsDateRaw * 1000).toISOString().slice(0, 10) : null,
      exDividendDate: typeof exDividendRaw === "number" ? new Date(exDividendRaw * 1000).toISOString().slice(0, 10) : null,
      // Histórico anual
      annualRevenue: toAnnualPoints(incomeStmts, "totalRevenue"),
      annualNetIncome: toAnnualPoints(incomeStmts, "netIncome"),
      annualEbitda,
      annualFreeCashflow: toAnnualPoints(cashflowStmts, "freeCashflow"),
      annualEquity: toAnnualPoints(balanceStmts, "totalStockholderEquity"),
      annualTotalDebt: toAnnualPoints(balanceStmts, "longTermDebt"),
    };
  } catch {
    return null;
  }
}
