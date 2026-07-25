import * as cheerio from "cheerio";

export interface FlowDayRaw {
  date: string; // YYYY-MM-DD
  foreigners: number;
  institutional: number;
  individuals: number;
  financialInstitutions: number;
  other: number;
}

const SOURCE_URL = "https://www.dadosdemercado.com.br/fluxo";

// "278,08 mi" / "-331,13 mi" / "1,20 bi" -> número em BRL
function parseBRLCell(raw: string): number {
  const text = raw.trim();
  const negative = text.startsWith("-");
  const unit = text.endsWith("bi") ? 1_000_000_000 : text.endsWith("mi") ? 1_000_000 : 1;
  const numeric = text.replace(/[^\d,]/g, "").replace(",", ".");
  const value = parseFloat(numeric) * unit;
  if (Number.isNaN(value)) return 0;
  return negative ? -Math.abs(value) : value;
}

function parseBRDate(raw: string): string {
  const [day, month, year] = raw.trim().split("/");
  return `${year}-${month}-${day}`;
}

// Fonte pública dadosdemercado.com.br — agrega o fluxo oficial da B3 (não é
// endpoint oficial da B3, que só disponibiliza o detalhamento via DataWise+, pago).
// Retorna em ordem cronológica ascendente (mais antigo primeiro).
export async function getFlowHistory(): Promise<FlowDayRaw[]> {
  const res = await fetch(SOURCE_URL, {
    headers: { "user-agent": "Mozilla/5.0" },
    next: { revalidate: 6 * 60 * 60 },
  });

  if (!res.ok) {
    throw new Error(`dadosdemercado.com.br respondeu ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: FlowDayRaw[] = [];

  $("table#flow tbody tr, table#flow tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 5) return; // pula a linha de cabeçalho

    rows.push({
      date: parseBRDate($(cells[0]).text()),
      foreigners: parseBRLCell($(cells[1]).text()),
      institutional: parseBRLCell($(cells[2]).text()),
      individuals: parseBRLCell($(cells[3]).text()),
      financialInstitutions: parseBRLCell($(cells[4]).text()),
      other: cells.length > 5 ? parseBRLCell($(cells[5]).text()) : 0,
    });
  });

  if (rows.length === 0) {
    throw new Error("Tabela de fluxo não encontrada na página (layout pode ter mudado)");
  }

  return rows.reverse();
}
