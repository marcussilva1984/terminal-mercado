import type { FlowSegment, FlowSignal } from "@/lib/types";
import { formatBRLCompact, changeColorClass } from "@/lib/format";
import { computeSmartMoneyFlow } from "@/lib/semaphore";

const SIGNAL_STYLE: Record<FlowSignal, string> = {
  verde: "bg-up",
  amarelo: "bg-amber",
  vermelho: "bg-down",
};

export function FlowSemaphore({ segments, compact = false }: { segments: FlowSegment[]; compact?: boolean }) {
  const smartMoney = computeSmartMoneyFlow(segments);

  return (
    <div className="flex flex-col divide-y divide-border/50">
      <div className="flex flex-col gap-1 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gold-bright">Estrangeiro + Institucional</span>
          <span className={`text-sm font-semibold tabular-nums ${changeColorClass(smartMoney.dailyBRL)}`}>
            Dia: {formatBRLCompact(smartMoney.dailyBRL)}
          </span>
        </div>
        {!compact && (
          <>
            <div className="flex gap-4 text-xs text-text-muted">
              <span className={changeColorClass(smartMoney.monthBRL)}>Mês: {formatBRLCompact(smartMoney.monthBRL)}</span>
              <span className={changeColorClass(smartMoney.yearBRL)}>Ano: {formatBRLCompact(smartMoney.yearBRL)}</span>
            </div>
            <p className="text-xs italic text-text-muted/80">
              Não existe &quot;total geral&quot; informativo: a soma de todas as categorias sempre dá ~zero
              (toda compra de uma é venda de outra). Estrangeiro + Institucional é o proxy mais próximo de
              &quot;dinheiro profissional&quot; que investidores costumam acompanhar.
            </p>
          </>
        )}
      </div>
      {segments.map((seg) => (
        <div key={seg.segment} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SIGNAL_STYLE[seg.signal]}`} />
              <span className="text-sm font-medium text-text">{seg.segment}</span>
            </div>
            <span className="text-sm tabular-nums text-text-muted">
              Dia: {formatBRLCompact(seg.dailyBRL)}
            </span>
          </div>
          {!compact && (
            <>
              <p className="text-xs text-text-muted">{seg.reading}</p>
              <div className="flex gap-4 text-xs text-text-muted">
                <span>Mês: {formatBRLCompact(seg.monthBRL)}</span>
                <span>Ano: {formatBRLCompact(seg.yearBRL)}</span>
              </div>
              {seg.note && <p className="text-xs italic text-text-muted/80">{seg.note}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
