// Relatório COT (Commitments of Traders) da CFTC — API pública Socrata, sem chave.
// Dataset 6dca-aqww = Legacy Futures Only, publicado toda sexta com posição da terça.
// "Non-commercial" = especuladores (fundos/large specs), o grupo que mostra o
// posicionamento direcional do mercado.

const COT_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

const CONTRACT_CODES: Record<string, string> = {
  EUR: "099741",
  JPY: "097741",
  GBP: "096742",
  CHF: "092741",
  CAD: "090741",
  AUD: "232741",
  NZD: "112741",
  USD: "098662", // USD Index (ICE)
};

export interface CotPosition {
  currency: string;
  net: number;
  netChange: number;
  longPct: number;
  cotIndex: number; // 0–100: onde a posição líquida atual está no range das últimas 52 semanas
  reportDate: string;
}

interface CotRow {
  report_date_as_yyyy_mm_dd: string;
  cftc_contract_market_code: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
}

export async function getCotPositions(): Promise<CotPosition[]> {
  const since = new Date(Date.now() - 53 * 7 * 86_400_000).toISOString().slice(0, 10);
  const codes = Object.values(CONTRACT_CODES).map((c) => `'${c}'`).join(",");
  const params = new URLSearchParams({
    $select:
      "report_date_as_yyyy_mm_dd,cftc_contract_market_code,noncomm_positions_long_all,noncomm_positions_short_all",
    $where: `cftc_contract_market_code in(${codes}) AND report_date_as_yyyy_mm_dd >= '${since}'`,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: "1000",
  });

  const res = await fetch(`${COT_URL}?${params}`, { next: { revalidate: 6 * 60 * 60 } });
  if (!res.ok) throw new Error(`CFTC respondeu ${res.status}`);
  const rows: CotRow[] = await res.json();

  const positions: CotPosition[] = [];
  for (const [currency, code] of Object.entries(CONTRACT_CODES)) {
    const series = rows
      .filter((r) => r.cftc_contract_market_code === code)
      .map((r) => {
        const long = Number(r.noncomm_positions_long_all);
        const short = Number(r.noncomm_positions_short_all);
        return { date: r.report_date_as_yyyy_mm_dd.slice(0, 10), long, short, net: long - short };
      });
    if (series.length < 2) continue;

    const [latest, previous] = series;
    const nets = series.map((s) => s.net);
    const min = Math.min(...nets);
    const max = Math.max(...nets);
    const total = latest.long + latest.short;

    positions.push({
      currency,
      net: latest.net,
      netChange: latest.net - previous.net,
      longPct: total > 0 ? (latest.long / total) * 100 : 50,
      cotIndex: max === min ? 50 : ((latest.net - min) / (max - min)) * 100,
      reportDate: latest.date,
    });
  }

  return positions;
}
