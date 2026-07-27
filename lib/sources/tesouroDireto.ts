// Fonte oficial gratuita: Tesouro Transparente (CKAN), CSV público com todo o
// histórico de preços/taxas do Tesouro Direto desde 2002. O arquivo é grande
// (~14MB) mas sem chave/cadastro.
const SOURCE_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

export interface TesouroBond {
  title: string;
  maturityDate: string; // ISO
  maturityYear: number;
  baseDate: string; // ISO
  buyRate: number | null;
  sellRate: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  change12MPct: number | null;
}

interface RawRow {
  title: string;
  maturityDate: string;
  baseDate: string;
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

  const rows: RawRow[] = lines.slice(1).map((l) => {
    const c = l.split(";");
    return {
      title: c[0]?.trim() ?? "",
      maturityDate: parseBRDate(c[1] ?? ""),
      baseDate: parseBRDate(c[2] ?? ""),
      buyRate: parseBRNumber(c[3] ?? ""),
      sellRate: parseBRNumber(c[4] ?? ""),
      buyPrice: parseBRNumber(c[5] ?? ""),
      sellPrice: parseBRNumber(c[6] ?? ""),
    };
  });

  // Descobre a data-base mais recente.
  let latestDate: Date | null = null;
  let latestISO: string | null = null;
  for (const r of rows) {
    if (!r.baseDate) continue;
    const date = new Date(r.baseDate);
    if (!latestDate || date > latestDate) {
      latestDate = date;
      latestISO = r.baseDate;
    }
  }
  if (!latestISO || !latestDate) throw new Error("Não foi possível determinar a data mais recente no CSV do Tesouro Direto");

  const targetPast = new Date(latestDate);
  targetPast.setFullYear(targetPast.getFullYear() - 1);

  // Agrupa por título+vencimento pra achar a linha de ~12 meses atrás de cada título.
  const byKey = new Map<string, RawRow[]>();
  for (const r of rows) {
    if (!r.title || !r.maturityDate) continue;
    const key = `${r.title}|${r.maturityDate}`;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }

  const latestRows = rows.filter((r) => r.baseDate === latestISO && r.title && r.buyPrice !== null);

  return latestRows
    .map((r) => {
      const key = `${r.title}|${r.maturityDate}`;
      const history = byKey.get(key) ?? [];
      // Linha com baseDate mais próxima de "1 ano atrás", tolerando até 20 dias de diferença.
      let closest: RawRow | null = null;
      let closestDiff = Infinity;
      for (const h of history) {
        if (h.buyPrice === null) continue;
        const diff = Math.abs(new Date(h.baseDate).getTime() - targetPast.getTime());
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = h;
        }
      }
      const withinTolerance = closest && closestDiff <= 20 * 24 * 60 * 60 * 1000;
      const change12MPct =
        withinTolerance && closest && closest.buyPrice
          ? ((r.buyPrice! - closest.buyPrice) / closest.buyPrice) * 100
          : null;

      return {
        title: r.title,
        maturityDate: r.maturityDate,
        maturityYear: new Date(r.maturityDate).getUTCFullYear(),
        baseDate: r.baseDate,
        buyRate: r.buyRate,
        sellRate: r.sellRate,
        buyPrice: r.buyPrice,
        sellPrice: r.sellPrice,
        change12MPct,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title) || a.maturityDate.localeCompare(b.maturityDate));
}
