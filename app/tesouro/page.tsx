import { Panel } from "@/components/Panel";
import { getTesouroDiretoRates } from "@/lib/sources/tesouroDireto";
import { formatNumber, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TesouroPage() {
  const now = new Date().toISOString();
  let bonds: Awaited<ReturnType<typeof getTesouroDiretoRates>> = [];
  let error: string | undefined;

  try {
    bonds = await getTesouroDiretoRates();
  } catch (err) {
    error = err instanceof Error ? err.message : "Falha ao carregar Tesouro Direto";
  }

  const byType = new Map<string, typeof bonds>();
  for (const b of bonds) {
    const list = byType.get(b.title) ?? [];
    list.push(b);
    byType.set(b.title, list);
  }

  const baseDate = bonds[0]?.baseDate;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Tesouro Direto</h1>
        <p className="mt-1 text-sm text-text-muted">
          Preços e taxas oficiais via Tesouro Transparente (gov.br), sem chave de API.{" "}
          {baseDate && (
            <>
              Data-base dos dados: <strong className="text-text">{new Date(baseDate).toLocaleDateString("pt-BR")}</strong> — a
              divulgação oficial costuma ter alguns dias de atraso.
            </>
          )}
        </p>
      </div>

      {error ? (
        <Panel title="Tesouro Transparente" updatedAt={now}>
          <p className="text-sm text-down">Fonte indisponível no momento: {error}</p>
        </Panel>
      ) : (
        Array.from(byType.entries()).map(([title, list]) => (
          <Panel key={title} title={title} updatedAt={now}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="pb-2 font-medium">Vencimento</th>
                    <th className="pb-2 font-medium text-right">Taxa Compra</th>
                    <th className="pb-2 font-medium text-right">Taxa Venda</th>
                    <th className="pb-2 font-medium text-right">PU Compra</th>
                    <th className="pb-2 font-medium text-right">PU Venda</th>
                  </tr>
                </thead>
                <tbody>
                  {list
                    .slice()
                    .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))
                    .map((b) => (
                      <tr key={b.maturityDate} className="border-b border-border/50 last:border-0">
                        <td className="py-2 text-text">{new Date(b.maturityDate).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2 text-right text-text">
                          {b.buyRate !== null ? `${formatNumber(b.buyRate)}%` : "—"}
                        </td>
                        <td className="py-2 text-right text-text">
                          {b.sellRate !== null ? `${formatNumber(b.sellRate)}%` : "—"}
                        </td>
                        <td className="py-2 text-right text-gold-bright">
                          {b.buyPrice !== null ? `R$ ${formatNumber(b.buyPrice)}` : "—"}
                        </td>
                        <td className="py-2 text-right text-text">
                          {b.sellPrice !== null ? `R$ ${formatNumber(b.sellPrice)}` : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ))
      )}

      <p className="text-xs text-text-muted">
        Atualizado em {formatDateTime(now)}. PU = Preço Unitário do título. Taxa de compra é a que você recebe
        se levar o título até o vencimento; taxa de venda é a de recompra antecipada pelo Tesouro.
      </p>
    </div>
  );
}
