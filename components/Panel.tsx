import type { ReactNode } from "react";
import { formatTime } from "@/lib/format";

export function Panel({
  title,
  updatedAt,
  children,
  action,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-gold-bright uppercase">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {action}
          {updatedAt && (
            <span className="text-xs text-text-muted">Atualizado {formatTime(updatedAt)}</span>
          )}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
