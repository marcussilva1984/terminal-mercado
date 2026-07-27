import * as cheerio from "cheerio";

// Finviz proíbe scraping automatizado nos termos de uso — usado aqui por
// decisão explícita do usuário, ciente do risco de bloqueio futuro (igual
// já aconteceu com outras fontes tipo farside.co.uk).
const BASE_URL = "https://finviz.com/quote.ashx";

export interface FinvizAnalystData {
  symbol: string;
  targetPrice: number | null;
  recommendation: string | null; // "Buy", "Hold" etc. (média dos analistas, escala 1-5 do Finviz)
}

async function fetchSnapshot(symbol: string): Promise<string> {
  const res = await fetch(`${BASE_URL}?t=${encodeURIComponent(symbol)}`, {
    headers: { "user-agent": "Mozilla/5.0" },
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) throw new Error(`Finviz respondeu ${res.status} para ${symbol}`);
  return res.text();
}

function extractSnapshotValue($: cheerio.CheerioAPI, label: string): string | null {
  let value: string | null = null;
  $("td").each((_, el) => {
    if (value) return;
    const text = $(el).text().trim();
    if (text === label) {
      const valueTd = $(el).next("td");
      value = valueTd.text().trim();
    }
  });
  return value;
}

export async function getAnalystTarget(symbol: string): Promise<FinvizAnalystData | null> {
  try {
    const html = await fetchSnapshot(symbol);
    const $ = cheerio.load(html);

    const targetRaw = extractSnapshotValue($, "Target Price");
    const recomRaw = extractSnapshotValue($, "Recom");

    const targetPrice = targetRaw ? parseFloat(targetRaw.replace(/[^\d.-]/g, "")) : null;

    return {
      symbol,
      targetPrice: targetPrice !== null && !Number.isNaN(targetPrice) ? targetPrice : null,
      recommendation: recomRaw || null,
    };
  } catch {
    return null;
  }
}

export async function getAnalystTargets(symbols: string[]): Promise<FinvizAnalystData[]> {
  const results = await Promise.all(symbols.map(getAnalystTarget));
  return results.filter((r): r is FinvizAnalystData => r !== null && r.targetPrice !== null);
}
