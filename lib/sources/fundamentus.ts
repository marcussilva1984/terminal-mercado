import * as cheerio from "cheerio";
import iconv from "iconv-lite";

// Fundamentus proíbe scraping automatizado nos termos de uso — usado aqui por
// decisão explícita do usuário, ciente do risco de bloqueio futuro (mesmo
// risco já aceito com o Finviz). Site declara ISO-8859-1 — decodifica manual
// senão os acentos quebram (mesmo problema já visto no RSS).
const BASE = "https://www.fundamentus.com.br";

async function fetchLatin1(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, next: { revalidate: 24 * 60 * 60 } });
  if (!res.ok) throw new Error(`Fundamentus respondeu ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return iconv.decode(buffer, "iso-8859-1");
}

export interface MajorShareholder {
  name: string;
  percentage: number;
}

export async function getMajorShareholders(symbol: string): Promise<MajorShareholder[]> {
  const html = await fetchLatin1(`${BASE}/principais_acionistas.php?papel=${encodeURIComponent(symbol)}&tipo=1`);
  const $ = cheerio.load(html);
  const shareholders: MajorShareholder[] = [];

  $("#acoesordinarias tr").each((i, el) => {
    if (i === 0) return; // cabeçalho
    const cells = $(el).find("td").map((_, c) => $(c).text().trim()).get();
    if (cells.length < 2) return;
    const pct = parseFloat(cells[1].replace("%", "").replace(",", "."));
    if (cells[0] && !Number.isNaN(pct)) shareholders.push({ name: cells[0], percentage: pct });
  });

  return shareholders;
}

export interface InsiderFlowMonth {
  date: string; // ISO (dia 1 do mês)
  quantity: number;
  valueBRL: number;
  avgPrice: number;
}

function parseBRDate(raw: string): string {
  const [day, month, year] = raw.trim().split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseBRNumber(raw: string): number {
  const v = parseFloat(raw.trim().replace(/\./g, "").replace(",", "."));
  return Number.isNaN(v) ? 0 : v;
}

// Fluxo líquido MENSAL de insiders (soma de todas as transações do mês) —
// não é por pessoa como o Form 4 americano, é o agregado da empresa.
export async function getInsiderFlow(symbol: string, limit = 12): Promise<InsiderFlowMonth[]> {
  const html = await fetchLatin1(`${BASE}/insiders.php?papel=${encodeURIComponent(symbol)}`);
  const $ = cheerio.load(html);
  const rows: InsiderFlowMonth[] = [];

  $("table tr").each((i, el) => {
    if (i === 0) return; // cabeçalho
    const cells = $(el).find("td").map((_, c) => $(c).text().trim()).get();
    if (cells.length < 4 || !cells[0].includes("/")) return;
    rows.push({
      date: parseBRDate(cells[0]),
      quantity: parseBRNumber(cells[1]),
      valueBRL: parseBRNumber(cells[2]),
      avgPrice: parseBRNumber(cells[3]),
    });
  });

  return rows.slice(0, limit);
}

export interface FundamentusSection {
  title: string;
  items: { label: string; value: string }[];
}

// Página inteira do Fundamentus é feita de pares rótulo/valor em tabelas —
// extrai tudo (P/L, P/VP, margens, ROE, ROIC, balanço, DRE etc.) genericamente
// em vez de tipar campo por campo, pra cobrir "todos os indicadores" de uma vez.
export async function getFullIndicators(symbol: string): Promise<FundamentusSection[]> {
  const html = await fetchLatin1(`${BASE}/detalhes.php?papel=${encodeURIComponent(symbol)}`);
  const $ = cheerio.load(html);

  const sectionTitles: Record<number, string> = {
    0: "Dados Gerais",
    1: "Valor de Mercado",
    2: "Oscilações e Indicadores Fundamentalistas",
    3: "Balanço Patrimonial",
    4: "Demonstrativo de Resultados",
  };

  const sections: FundamentusSection[] = [];

  $("table").each((tableIndex, table) => {
    const items: { label: string; value: string }[] = [];
    $(table)
      .find("tr")
      .each((_, row) => {
        const cells = $(row)
          .find("td")
          .map((_, c) => $(c).text().trim())
          .get();
        // Linhas são pares label/valor repetidos (2 ou 4 colunas por linha).
        for (let i = 0; i < cells.length - 1; i += 2) {
          const label = cells[i]?.replace(/^\?/, "").trim();
          const value = cells[i + 1]?.trim();
          // Pula linhas de subcabeçalho (ex.: "Oscilações" / "Indicadores
          // fundamentalistas", "Últimos 12 meses" / "Últimos 3 meses") — não
          // são pares label/valor de verdade, são títulos de coluna.
          if (label && value && !/^(Últimos|Indicadores)/.test(value)) items.push({ label, value });
        }
      });
    if (items.length > 0) {
      sections.push({ title: sectionTitles[tableIndex] ?? `Seção ${tableIndex + 1}`, items });
    }
  });

  if (sections.length === 0) throw new Error(`Nenhum indicador encontrado no Fundamentus para ${symbol}`);
  return sections;
}
