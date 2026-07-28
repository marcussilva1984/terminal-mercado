import type { NewsItem } from "@/lib/types";
import { formatTime } from "@/lib/format";

// Manchete em destaque — a notícia de maior impacto do momento, em fonte
// grande no topo da Home (mesma detecção de "alto impacto" já usada no
// feed e no alerta imediato do Telegram, só que reaproveitada aqui como
// resumo visual do que está mexendo o mercado agora).
export function Headline({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      className="block rounded-lg border border-down/40 bg-down/10 px-4 py-3 transition-colors hover:bg-down/15"
    >
      <span className="mr-2 inline-block rounded border border-down/40 bg-down/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-down align-middle">
        Manchete
      </span>
      <span className="text-base font-semibold leading-snug text-text">{item.title}</span>
      <div className="mt-1 text-xs text-text-muted">
        {item.source} · {formatTime(item.publishedAt)}
      </div>
    </a>
  );
}
