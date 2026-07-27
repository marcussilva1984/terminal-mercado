// Fonte oficial gratuita: Tesouro Transparente (CKAN), CSV público com todo o
// histórico de preços/taxas do Tesouro Direto desde 2002. O arquivo é grande
// (~14MB) mas sem chave/cadastro — filtramos pra manter só a data mais recente.
const SOURCE_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

export interface TesouroBond {
  title: string;
  maturityDate: string; // ISO
  baseDate: string; // ISO
  buyRate: number | null;
  sellRate: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
}

function parseBRNumber(raw: string): number | null {
  const v = parseFloat(raw.trim().replace(",", "."));
  return Number.isNaN(v) ? null : v;
}

function parseBRDate(raw: string): string {
  const [day, month, year] = raw.trim().split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export async function getTesouroDiretoRates(): Promise<TesouroBond[]> {
  const res = await fetch(SOURCE_URL, {
    headers: { "user-agent": "Mozilla/5.0" },
    // Atualiza no máximo algumas vezes ao dia — arquivo pesado (14MB), não vale
    // a pena rebaixar pra no-store.
    next: { revalidate: 4 * 60 * 60 },
  });
  if (!res.ok) throw new Error(`tesourotransparente.gov.br respondeu ${res.status}`);

  const buffer = await res.arrayBuffer();
  const text = new TextDecoder("latin1").decode(buffer); // CSV vem em ISO-8859-1
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV do Tesouro Direto vazio ou em formato inesperado");

  const rows = lines.slice(1).map((l) => l.split(";"));

  // Descobre a data-base mais recente (formato dd/mm/yyyy) comparando como Date.
  let latestRaw: string | null = null;
  let latestDate: Date | null = null;
  for (const r of rows) {
    const raw = r[2]?.trim();
    if (!raw) continue;
    const [d, m, y] = raw.split("/");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!latestDate || date > latestDate) {
      latestDate = date;
      latestRaw = raw;
    }
  }
  if (!latestRaw) throw new Error("Não foi possível determinar a data mais recente no CSV do Tesouro Direto");

  return rows
    .filter((r) => r[2]?.trim() === latestRaw)
    .map((r) => ({
      title: r[0]?.trim() ?? "",
      maturityDate: parseBRDate(r[1]),
      baseDate: parseBRDate(r[2]),
      buyRate: parseBRNumber(r[3] ?? ""),
      sellRate: parseBRNumber(r[4] ?? ""),
      buyPrice: parseBRNumber(r[5] ?? ""),
      sellPrice: parseBRNumber(r[6] ?? ""),
    }))
    .filter((b) => b.title && b.buyPrice !== null)
    .sort((a, b) => a.title.localeCompare(b.title) || a.maturityDate.localeCompare(b.maturityDate));
}
