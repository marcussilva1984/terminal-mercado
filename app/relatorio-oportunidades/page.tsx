import {
  getGrahamValuations,
  getBazinValuationsB3,
  getBazinValuationsFii,
  getDcfValuations,
} from "@/lib/valuation";
import { B3_WATCHLIST, FII_WATCHLIST } from "@/lib/watchlist";
import { getWatchlist } from "@/lib/db/watchlistRepo";
import { hasDatabase } from "@/lib/db/client";
import { formatPrice } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export const revalidate = 240;

function dedupe(a: { symbol: string; label: string }[], b: { symbol: string; label: string }[]) {
  const merged = [...a, ...b];
  const seen = new Set<string>();
  return merged.filter((x) => {
    if (seen.has(x.symbol)) return false;
    seen.add(x.symbol);
    return true;
  });
}

export default async function RelatorioOportunidadesPage() {
  const b3Watchlist = hasDatabase() ? dedupe(B3_WATCHLIST, await getWatchlist("b3").catch(() => [])) : B3_WATCHLIST;
  const fiiWatchlist = hasDatabase() ? dedupe(FII_WATCHLIST, await getWatchlist("fii").catch(() => [])) : FII_WATCHLIST;

  const [graham, bazinB3, bazinFii, dcf] = await Promise.all([
    getGrahamValuations(b3Watchlist).catch(() => []),
    getBazinValuationsB3(b3Watchlist).catch(() => []),
    getBazinValuationsFii(fiiWatchlist).catch(() => []),
    getDcfValuations(b3Watchlist).catch(() => []),
  ]);

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
          <p className="text-sm text-gray-600">Relatório de Oportunidades — {date}</p>
        </div>
        <PrintButton />
      </div>

      {graham.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Fórmula de Graham (Ações B3)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Ativo</th>
                <th className="py-1 text-right">Preço</th>
                <th className="py-1 text-right">Valor Justo</th>
                <th className="py-1 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {graham.map((g) => (
                <tr key={g.symbol} className="border-b border-gray-100">
                  <td className="py-1">
                    {g.symbol} <span className="text-gray-500">({g.label})</span>
                  </td>
                  <td className="py-1 text-right">{formatPrice(g.price, "BRL")}</td>
                  <td className="py-1 text-right">{formatPrice(g.fairValue, "BRL")}</td>
                  <td className="py-1 text-right">
                    {g.marginOfSafetyPct >= 0 ? "+" : ""}
                    {g.marginOfSafetyPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {bazinB3.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Método Bazin (Ações B3)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Ativo</th>
                <th className="py-1 text-right">Preço</th>
                <th className="py-1 text-right">Preço Justo</th>
                <th className="py-1 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {bazinB3.map((b) => (
                <tr key={b.symbol} className="border-b border-gray-100">
                  <td className="py-1">
                    {b.symbol} <span className="text-gray-500">({b.label})</span>
                  </td>
                  <td className="py-1 text-right">{formatPrice(b.price, "BRL")}</td>
                  <td className="py-1 text-right">{formatPrice(b.fairPrice, "BRL")}</td>
                  <td className="py-1 text-right">
                    {b.marginOfSafetyPct >= 0 ? "+" : ""}
                    {b.marginOfSafetyPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {bazinFii.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">Método Bazin (FII)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Ativo</th>
                <th className="py-1 text-right">Preço</th>
                <th className="py-1 text-right">Preço Justo</th>
                <th className="py-1 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {bazinFii.map((b) => (
                <tr key={b.symbol} className="border-b border-gray-100">
                  <td className="py-1">
                    {b.symbol} <span className="text-gray-500">({b.label})</span>
                  </td>
                  <td className="py-1 text-right">{formatPrice(b.price, "BRL")}</td>
                  <td className="py-1 text-right">{formatPrice(b.fairPrice, "BRL")}</td>
                  <td className="py-1 text-right">
                    {b.marginOfSafetyPct >= 0 ? "+" : ""}
                    {b.marginOfSafetyPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {dcf.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold border-b border-gray-300 pb-1">DCF (Ações B3)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Ativo</th>
                <th className="py-1 text-right">Preço</th>
                <th className="py-1 text-right">Valor Justo</th>
                <th className="py-1 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {dcf.map((d) => (
                <tr key={d.symbol} className="border-b border-gray-100">
                  <td className="py-1">
                    {d.symbol} <span className="text-gray-500">({d.label})</span>
                  </td>
                  <td className="py-1 text-right">{formatPrice(d.price, "BRL")}</td>
                  <td className="py-1 text-right">{formatPrice(d.fairValue, "BRL")}</td>
                  <td className="py-1 text-right">
                    {d.marginOfSafetyPct >= 0 ? "+" : ""}
                    {d.marginOfSafetyPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-8 border-t border-gray-300 pt-3 text-xs text-gray-500">
        Gerado automaticamente pelo Terminal de Mercado — Graham/Bazin via Fundamentus, DCF via
        demonstrativo oficial de fluxo de caixa da CVM (ano fiscal mais recente, premissas de
        crescimento/desconto fixas e genéricas). Nenhuma tabela aqui é recomendação de compra/venda
        — consulte a aba Oportunidades no site pra ver as limitações detalhadas de cada método.
      </p>
    </div>
  );
}
