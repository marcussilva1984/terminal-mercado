import type { FatoRelevante } from "@/lib/sources/cvmFatosRelevantes";

export function FatosRelevantesTable({ items }: { items: FatoRelevante[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum fato relevante publicado recentemente.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {items.map((f, i) => (
        <li key={i} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-text">{f.companyName}</span>
            <span className="shrink-0 text-xs text-text-muted">{new Date(f.date).toLocaleDateString("pt-BR")}</span>
          </div>
          {f.documentUrl ? (
            <a href={f.documentUrl} target="_blank" rel="noreferrer" className="text-sm text-gold-bright hover:underline">
              {f.subject}
            </a>
          ) : (
            <span className="text-sm text-text-muted">{f.subject}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
