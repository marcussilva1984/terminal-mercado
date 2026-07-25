export function ZScoreBadge({ zScore }: { zScore: number }) {
  const abs = Math.abs(zScore);
  const tone =
    abs >= 3
      ? "bg-down/15 text-down border-down/40"
      : abs >= 2
        ? "bg-amber/15 text-amber border-amber/40"
        : "bg-panel-alt text-text-muted border-border";

  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium tabular-nums ${tone}`}>
      z {zScore > 0 ? "+" : ""}
      {zScore.toFixed(1)}
    </span>
  );
}
