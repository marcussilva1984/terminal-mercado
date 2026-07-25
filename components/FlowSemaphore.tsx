import type { FlowSegment, FlowSignal } from "@/lib/types";
import { formatBRLCompact } from "@/lib/format";

const SIGNAL_STYLE: Record<FlowSignal, string> = {
  verde: "bg-up",
  amarelo: "bg-amber",
  vermelho: "bg-down",
};

export function FlowSemaphore({ segments, compact = false }: { segments: FlowSegment[]; compact?: boolean }) {
  return (
    <div className="flex flex-col divide-y divide-border/50">
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
