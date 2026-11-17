import { changeColorClass, formatPct } from "@/lib/format";

// Ideia 4: número grande + cor de fundo quando movimento > 2%
function bgForChange(pct: number): string {
  const abs = Math.abs(pct);
  if (abs < 0.1) return "bg-panel-alt border-border";
  if (abs >= 2) return pct > 0 ? "bg-up/15 border-up/40" : "bg-down/15 border-down/40";
  return "bg-panel-alt border-border";
}

export function StatCard({
  label,
  value,
  changePct,
}: {
  label: string;
  value: string;
  changePct: number;
}) {
  return (
    <div className={`rounded-md border px-4 py-3 ${bgForChange(changePct)}`}>
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xl font-bold text-text tabular-nums">{value}</span>
        {changePct !== 0 && (
          <span className={`text-sm font-semibold tabular-nums ${changeColorClass(changePct)}`}>
            {formatPct(changePct)}
          </span>
        )}
      </div>
    </div>
  );
}
