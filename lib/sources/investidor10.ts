import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";
import * as cheerio from "cheerio";

export interface FiiDividendYield {
  symbol: string;
  name: string;
  dividendYieldPct: number;
}

const URL = "https://investidor10.com.br/fiis/rankings/maior-dividend-yield/";

// Tabela server-renderizada (sem precisar de JS) com o ranking de FIIs por dividend
// yield dos últimos 12 meses, ordenado desc pela própria página.
export async function getFiiDividendYieldRanking(limit = 20): Promise<FiiDividendYield[]> {
  const res = await fetch(URL, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    next: { revalidate: 6 * 60 * 60 },
  });

  if (!res.ok) throw new Error(`investidor10.com.br respondeu ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const results: FiiDividendYield[] = [];

  $("table#rankigns tbody tr").each((_, el) => {
    if (results.length >= limit) return;
    const link = $(el).find("a[href*='/fiis/']").first();
    const href = link.attr("href") ?? "";
    const symbol = href.split("/fiis/")[1]?.replace(/\/$/, "").toUpperCase();
    const name = link.attr("title") ?? symbol;
    const dyText = $(el).find("td").eq(1).text().trim();
    const dividendYieldPct = parseFloat(dyText.replace("%", "").replace(",", "."));

    if (symbol && !Number.isNaN(dividendYieldPct)) {
      results.push({ symbol, name, dividendYieldPct });
    }
  });

  if (results.length === 0) {
    throw new Error("Tabela de dividend yield não encontrada (layout pode ter mudado)");
  }

  return results;
}
