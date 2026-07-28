// Transações de insiders (Form 4) via SEC EDGAR — API oficial e gratuita do
// governo dos EUA, sem chave (só exige um User-Agent identificável, que a
// própria SEC pede por política de acesso justo, não é bloqueio).
const UA = "TerminalMercado terminal-mercado-contact@example.com";

let tickerCikMap: Map<string, string> | null = null;

async function getCikForSymbol(symbol: string): Promise<string | null> {
  if (!tickerCikMap) {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "user-agent": UA },
      next: { revalidate: 24 * 60 * 60 },
    });
    const json = await res.json();
    tickerCikMap = new Map();
    for (const entry of Object.values(json) as { ticker: string; cik_str: number }[]) {
      tickerCikMap.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
    }
  }
  return tickerCikMap.get(symbol.toUpperCase()) ?? null;
}

interface Form4Filing {
  accessionNumber: string;
  primaryDocument: string;
  filingDate: string;
}

async function getRecentForm4Filings(cik: string, limit: number): Promise<Form4Filing[]> {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { "user-agent": UA },
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const recent = json?.filings?.recent;
  if (!recent) return [];

  const filings: Form4Filing[] = [];
  for (let i = 0; i < recent.form.length && filings.length < limit; i++) {
    if (recent.form[i] === "4") {
      filings.push({
        accessionNumber: recent.accessionNumber[i],
        primaryDocument: recent.primaryDocument[i],
        filingDate: recent.filingDate[i],
      });
    }
  }
  return filings;
}

// Tags como <transactionDate><value>2026-07-01</value></transactionDate>.
function extractValueTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>\\s*<value>([^<]*)</value>`, "i"));
  return match ? match[1].trim() : null;
}

// Tags diretas como <rptOwnerName>COXE TENCH</rptOwnerName> (sem <value> aninhado).
function extractDirectTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

export interface InsiderTransaction {
  symbol: string;
  ownerName: string;
  relationship: string;
  transactionDate: string;
  transactionCode: string; // P=compra, S=venda (códigos mais comuns)
  shares: number | null;
  pricePerShare: number | null;
  acquiredDisposed: "A" | "D" | null;
  filingUrl: string;
}

async function fetchRawXmlUrl(cik: string, accessionNumber: string, primaryDocument: string): Promise<string> {
  const accessionNoDashes = accessionNumber.replace(/-/g, "");
  // primaryDocument costuma vir como "xslF345X06/arquivo.xml" (versão renderizada) —
  // o XML cru fica direto na pasta da accession, com o mesmo nome de arquivo.
  const filename = primaryDocument.split("/").pop();
  return `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accessionNoDashes}/${filename}`;
}

async function parseForm4(symbol: string, cik: string, filing: Form4Filing): Promise<InsiderTransaction[]> {
  try {
    const xmlUrl = await fetchRawXmlUrl(cik, filing.accessionNumber, filing.primaryDocument);
    const res = await fetch(xmlUrl, { headers: { "user-agent": UA }, next: { revalidate: 60 * 60 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const ownerName = extractDirectTag(xml, "rptOwnerName") ?? "Desconhecido";
    const isDirector = extractDirectTag(xml, "isDirector") === "1";
    const isOfficer = extractDirectTag(xml, "isOfficer") === "1";
    const isTenPercent = extractDirectTag(xml, "isTenPercentOwner") === "1";
    const relationship = [isDirector && "Diretor(a)", isOfficer && "Executivo(a)", isTenPercent && "Dono(a) 10%+"]
      .filter(Boolean)
      .join(", ") || "Insider";

    const filingUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4`;

    const transactions: InsiderTransaction[] = [];
    const txBlocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) ?? [];
    for (const block of txBlocks) {
      const date = extractValueTag(block, "transactionDate");
      const code = block.match(/<transactionCode>([^<]*)</)?.[1] ?? "";
      const sharesRaw = extractValueTag(block, "transactionShares");
      const priceRaw = extractValueTag(block, "transactionPricePerShare");
      const acqDisp = extractValueTag(block, "transactionAcquiredDisposedCode") as "A" | "D" | null;

      if (!date) continue;
      transactions.push({
        symbol,
        ownerName,
        relationship,
        transactionDate: date,
        transactionCode: code,
        shares: sharesRaw ? parseFloat(sharesRaw) : null,
        pricePerShare: priceRaw ? parseFloat(priceRaw) : null,
        acquiredDisposed: acqDisp,
        filingUrl,
      });
    }
    return transactions;
  } catch {
    return [];
  }
}

// Só transações reais em dinheiro (P = compra em mercado aberto, S = venda em
// mercado aberto) — filtra fora exercícios de opção, doações, planos 10b5-1
// automáticos etc., que não representam uma decisão discricionária de compra/venda.
const RELEVANT_CODES = new Set(["P", "S"]);

export async function getInsiderTransactionsForSymbol(symbol: string, filingsLimit = 3): Promise<InsiderTransaction[]> {
  const cik = await getCikForSymbol(symbol);
  if (!cik) return [];
  const filings = await getRecentForm4Filings(cik, filingsLimit);
  const results = await Promise.all(filings.map((f) => parseForm4(symbol, cik, f)));
  return results.flat().filter((t) => RELEVANT_CODES.has(t.transactionCode));
}

export async function getInsiderTransactionsForWatchlist(symbols: string[]): Promise<InsiderTransaction[]> {
  const results = await Promise.all(symbols.map((s) => getInsiderTransactionsForSymbol(s, 3)));
  return results
    .flat()
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .slice(0, 30);
}
