import type { NewsItem } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { getNewsPriority } from "@/lib/sentiment";

const PRIORITY_BADGE: Record<"alta" | "media", { label: string; badgeClass: string; textClass: string }> = {
  alta: {
    label: "Alta Prioridade",
    badgeClass: "border-down/40 bg-down/10 text-down",
    textClass: "font-semibold text-down",
  },
  media: {
    label: "Média Prioridade",
    badgeClass: "border-amber/40 bg-amber/10 text-amber",
    textClass: "font-medium text-amber",
  },
};

export function NewsFeed({ items, now }: { items: NewsItem[]; now: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem notícias no momento.</p>;
  }

  const nowMs = new Date(now).getTime();
  const isRecent = (iso: string) => nowMs - new Date(iso).getTime() < 15 * 60 * 1000;

  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {items.map((item, i) => {
        const priority = getNewsPriority(item.title);
        const badge = priority !== "baixa" ? PRIORITY_BADGE[priority] : null;
        return (
          <li key={`${item.url}-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="mt-1 shrink-0 text-xs tabular-nums text-text-muted">
              {formatTime(item.publishedAt)}
            </span>
            <div className="min-w-0">
              {badge && (
                <span
                  className={`mr-1.5 inline-block rounded border px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle ${badge.badgeClass}`}
                >
                  {badge.label}
                </span>
              )}
              <a
                href={item.url}
                className={`text-sm leading-snug hover:underline ${
                  badge ? badge.textClass : isRecent(item.publishedAt) ? "text-gold-bright" : "text-text"
                }`}
              >
                {item.title}
              </a>
              <div className="mt-0.5 text-xs text-text-muted">{item.source}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
