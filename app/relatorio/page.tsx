import { getFlowHistory } from "@/lib/sources/b3Flow";
import { buildFlowSegments } from "@/lib/semaphore";
import { getZScoreHighlights } from "@/lib/zscoreService";
import { getBrapiRanking, type BrapiListItem } from "@/lib/sources/brapi";
import { getRecentAlerts } from "@/lib/db/alertRepo";
import { buildB3Insights } from "@/lib/insights";
import { formatPct, formatBRLCompact } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import type { RankingItem } from "@/lib/types";

export const revalidate = 240;

function toRankingItem(item: BrapiListItem): RankingItem {
  return { symbol: item.symbol, label: item.name, value: item.close, changePct: item.changePct, volume: item.volume };
}

export default async function RelatorioPage() {
  const [flowResult, zScoreResult, gainersResult, losersResult, volumeResult, alertsResult] = await Promise.allSettled([
    getFlowHistory(),
    getZScoreHighlights("b3"),
    getBrapiRanking("change", "desc", 5),
    getBrapiRanking("change", "asc", 5),
    getBrapiRanking("volume", "desc", 10),
    getRecentAlerts(24),
  ]);

  const flowSegments = flowResult.status === "fulfilled" ? buildFlowSegments(flowResult.value) : null;
  const zScoreHighlights = zScoreResult.status === "fulfilled" ? zScoreResult.value : null;
  const altas = gainersResult.status === "fulfilled" ? gainersResult.value.map(toRankingItem) : null;
  const baixas = losersResult.status === "fulfilled" ? losersResult.value.map(toRankingItem) : null;
  const byVolume = volumeResult.status === "fulfilled" ? volumeResult.value.map(toRankingItem) : null;
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : null;

  const insights =
    altas && baixas && byVolume && flowSegments ? buildB3Insights(altas, baixas, byVolume, flowSegments, zScoreHighlights ?? []) : [];

  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <style>{`
        @media print {
          body { background: white !important; }
          nav, header { display: none !important; }
        }
      `}</style>

      <div className="mb-6 flex items-center justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-2xl font-bold">Terminal de Mercado</h1>
          <p className="text-sm text-gray-600">Relatório Diário — {date}</p>
        </div>
        <PrintButton />
      </div>

      {insights.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Insights do Dia</h2>
          <ul className="list-disc pl-5 text-sm">
            {insights.map((i, idx) => (
              <li key={idx} className="mb-1">
                {i}
              </li>
            ))}
          </ul>
        </section>
      )}

      {flowSegments && flowSegments.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Fluxo de Investidores B3 (dia)</h2>
          <table className="w-full text-sm">
            <tbody>
              {flowSegments.map((s) => (
                <tr key={s.segment} className="border-b border-gray-200">
                  <td className="py-1 font-medium">{s.segment}</td>
                  <td className="py-1 text-right">{formatBRLCompact(s.dailyBRL)}</td>
                  <td className="py-1 text-right text-gray-500">sinal {s.signal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-6">
        {altas && altas.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Maiores Altas — B3</h2>
            <ul className="text-sm">
              {altas.map((a) => (
                <li key={a.symbol} className="flex justify-between border-b border-gray-100 py-1">
                  <span>
                    {a.symbol} <span className="text-gray-500">({a.label})</span>
                  </span>
                  <span>{formatPct(a.changePct)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {baixas && baixas.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Maiores Baixas — B3</h2>
            <ul className="text-sm">
              {baixas.map((b) => (
                <li key={b.symbol} className="flex justify-between border-b border-gray-100 py-1">
                  <span>
                    {b.symbol} <span className="text-gray-500">({b.label})</span>
                  </span>
                  <span>{formatPct(b.changePct)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {zScoreHighlights && zScoreHighlights.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Z-Score — Movimentos Fora do Padrão</h2>
          <ul className="text-sm">
            {zScoreHighlights.slice(0, 8).map((z) => (
              <li key={`${z.assetClass}-${z.symbol}`} className="flex justify-between border-b border-gray-100 py-1">
                <span>
                  {z.symbol} <span className="text-gray-500">({z.assetClass.toUpperCase()})</span>
                </span>
                <span>
                  {formatPct(z.changePct)}, z={z.zScore.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {alerts && alerts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Alertas Disparados (24h)</h2>
          <ul className="text-sm">
            {alerts.slice(0, 10).map((a, idx) => (
              <li key={idx} className="border-b border-gray-100 py-1">
                [{a.kind}] {a.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 border-t border-gray-300 pt-3 text-xs text-gray-500">
        Gerado automaticamente pelo Terminal de Mercado — dados de fontes públicas gratuitas (Yahoo
        Finance, CoinGecko, brapi.dev, CVM). Não constitui recomendação de investimento.
      </p>
    </div>
  );
}
