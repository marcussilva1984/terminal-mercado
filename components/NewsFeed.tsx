import type { NewsItem } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { isExtremeNews } from "@/lib/sentiment";

export function NewsFeed({ items, now }: { items: NewsItem[]; now: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Sem notícias no momento.</p>;
  }

  const nowMs = new Date(now).getTime();
  const isRecent = (iso: string) => nowMs - new Date(iso).getTime() < 15 * 60 * 1000;

  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {items.map((item, i) => {
        const extreme = isExtremeNews(item.title);
        return (
          <li key={`${item.url}-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="mt-1 shrink-0 text-xs tabular-nums text-text-muted">
              {formatTime(item.publishedAt)}
            </span>
            <div className="min-w-0">
              {extreme && (
                <span className="mr-1.5 inline-block rounded border border-down/40 bg-down/10 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-down align-middle">
                  Alto impacto
                </span>
              )}
              <a
                href={item.url}
                className={`text-sm leading-snug hover:underline ${
                  extreme ? "font-semibold text-down" : isRecent(item.publishedAt) ? "text-gold-bright" : "text-text"
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
