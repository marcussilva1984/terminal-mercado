import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/format";

// Ideia 2: faixa de cor por painel — a cor tinge só o título, não o fundo inteiro
const ACCENT: Record<string, string> = {
  lime: "text-lime-400",
  purple: "text-purple-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  gold: "text-gold-bright",
};

export function Panel({
  title,
  updatedAt,
  children,
  action,
  accent,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
  action?: ReactNode;
  accent?: keyof typeof ACCENT;
}) {
  const titleColor = accent ? ACCENT[accent] : ACCENT.gold;
  return (
    <section className="rounded-lg border border-border bg-panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className={`text-sm font-semibold tracking-wide uppercase ${titleColor}`}>
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {action}
          {updatedAt && (
            <span className="text-xs text-text-muted">Atualizado {formatDateTime(updatedAt)}</span>
          )}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
