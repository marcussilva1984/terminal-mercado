import { Panel } from "@/components/Panel";
import { getTesouroDiretoRates } from "@/lib/sources/tesouroDireto";
import { formatNumber, formatDateTime, changeColorClass } from "@/lib/format";

export const dynamic = "force-dynamic";

// Prefixo de rentabilidade mostrado ao lado da taxa, conforme o indexador do título.
function rateIndex(title: string): string {
  if (title.includes("Selic")) return "Selic +";
  if (title.includes("IPCA")) return "IPCA +";
  if (title.includes("IGPM")) return "IGP-M +";
  return "";
}

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {list
                .slice()
                .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))
                .map((b) => (
                  <div key={b.maturityDate} className="rounded-md border border-border bg-panel-alt p-4">
                    <div className="text-sm font-medium text-text">
                      {title} {b.maturityYear}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-text-muted">Taxa</div>
                        <div className="font-semibold text-text">
                          {rateIndex(title)}
                          {b.buyRate !== null ? formatNumber(b.buyRate) : "—"}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Variação 12M</div>
                        <div className={`font-semibold ${b.change12MPct !== null ? changeColorClass(b.change12MPct) : "text-text-muted"}`}>
                          {b.change12MPct !== null ? (
                            <>
                              {b.change12MPct >= 0 ? "↑" : "↓"} {formatNumber(Math.abs(b.change12MPct))}%
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">venda</div>
                        <div className="text-text">{b.sellPrice !== null ? `R$ ${formatNumber(b.sellPrice)}` : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">compra</div>
                        <div className="text-gold-bright">{b.buyPrice !== null ? `R$ ${formatNumber(b.buyPrice)}` : "—"}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </Panel>
        ))
      )}

      <p className="text-xs text-text-muted">
        Atualizado em {formatDateTime(now)}. Variação 12M = variação do PU de compra frente à data mais próxima
        de 12 meses atrás (tolerância de até 20 dias). Taxa de compra é a que você recebe se levar o título até o
        vencimento; PU = Preço Unitário.
      </p>
    </div>
  );
}
