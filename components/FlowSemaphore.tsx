import type { FlowSegment } from "@/lib/types";
import { formatBRLCompact, changeColorClass } from "@/lib/format";
import { computeSmartMoneyFlow } from "@/lib/semaphore";

// Ideia B3 Flow: cor por tipo de investidor
const SEGMENT_COLOR: Record<string, string> = {
  Estrangeiro: "bg-cyan-500",
  Institucional: "bg-purple-500",
  "Pessoa Física": "bg-amber-500",
  "Inst. Financeiras": "bg-lime-500",
};

function segColor(name: string): string {
  for (const key of Object.keys(SEGMENT_COLOR)) {
    if (name.includes(key)) return SEGMENT_COLOR[key];
  }
  return "bg-text-muted";
}

// Barra: venda à esquerda (vermelho), compra à direita (verde)
// O valor é o fluxo líquido; para a barra usamos o abs relativo ao maior abs do conjunto
function FlowBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs === 0 ? 0 : Math.min(100, (Math.abs(value) / maxAbs) * 100);
  const buying = value > 0;
  return (
    <div className="flex h-3 w-full items-center gap-0.5">
      {/* lado venda (esquerda) */}
      <div className="flex flex-1 justify-end">
        {!buying && (
          <div
            className="h-2 rounded-l bg-down"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div className="h-3 w-px shrink-0 bg-border" />
      {/* lado compra (direita) */}
      <div className="flex-1">
        {buying && (
          <div
            className="h-2 rounded-r bg-up"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function FlowSemaphore({ segments, compact = false }: { segments: FlowSegment[]; compact?: boolean }) {
  const smartMoney = computeSmartMoneyFlow(segments);
  const maxAbs = Math.max(...segments.map((s) => Math.abs(s.dailyBRL)), 1);

  return (
    <div className="flex flex-col gap-3">
      {/* cabeçalho smart money */}
      <div className="flex items-center justify-between gap-2 rounded border border-border/50 bg-panel-alt px-3 py-2">
        <span className="text-sm font-semibold text-gold-bright">Estrangeiro + Institucional</span>
        <span className={`text-sm font-semibold tabular-nums ${changeColorClass(smartMoney.dailyBRL)}`}>
          {formatBRLCompact(smartMoney.dailyBRL)}
        </span>
      </div>

      {/* legenda da barra */}
      <div className="flex justify-between text-[10px] text-text-muted px-1">
        <span>← venda</span>
        <span>compra →</span>
      </div>

      {/* barras por segmento */}
      <div className="flex flex-col gap-2">
        {segments.map((seg) => (
          <div key={seg.segment}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${segColor(seg.segment)}`} />
                <span className="text-xs font-medium text-text">{seg.segment}</span>
              </div>
              <span className={`text-xs tabular-nums ${changeColorClass(seg.dailyBRL)}`}>
                {formatBRLCompact(seg.dailyBRL)}
              </span>
            </div>
            <FlowBar value={seg.dailyBRL} maxAbs={maxAbs} />
            {!compact && seg.reading && (
              <p className="mt-0.5 text-[10px] text-text-muted">{seg.reading}</p>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <p className="text-xs italic text-text-muted/80">
          Soma de todas as categorias dá ~zero (toda compra é venda de outra). Estrangeiro +
          Institucional é o proxy de &quot;dinheiro profissional&quot;.
        </p>
      )}
    </div>
  );
}
