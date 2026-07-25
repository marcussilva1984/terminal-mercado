import { changeColorClass, formatPct } from "@/lib/format";

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
    <div className="rounded-md border border-border bg-panel-alt px-4 py-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold text-text">{value}</span>
        {changePct !== 0 && (
          <span className={`text-sm ${changeColorClass(changePct)}`}>{formatPct(changePct)}</span>
        )}
      </div>
    </div>
  );
}
