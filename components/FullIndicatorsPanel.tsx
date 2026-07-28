import type { FundamentusSection } from "@/lib/sources/fundamentus";

export function FullIndicatorsPanel({ sections }: { sections: FundamentusSection[] }) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{section.title}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
            {section.items.map((item, i) => (
              <div key={`${item.label}-${i}`}>
                <div className="text-xs text-text-muted">{item.label}</div>
                <div className="text-sm font-medium text-text">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-text-muted">Via Fundamentus.com.br — todos os indicadores disponíveis na fonte.</p>
    </div>
  );
}
