import type { FundamentusSection } from "@/lib/sources/fundamentus";
import { classifyIndicator, TONE_CLASS } from "@/lib/indicatorColor";

const SUBGROUP_MATCHERS: { title: string; test: (label: string) => boolean }[] = [
  { title: "Endividamento", test: (l) => /dív|liquidez/i.test(l) },
  { title: "Eficiência (Margens)", test: (l) => /marg|giro/i.test(l) },
  { title: "Rentabilidade", test: (l) => /roe|roic|roa|ebit \/ ativo|cres\. rec/i.test(l) },
];

function splitIndicadoresFundamentalistas(items: { label: string; value: string }[]) {
  const groups: Record<string, { label: string; value: string }[]> = { "Valuation / Outros": [] };
  for (const g of SUBGROUP_MATCHERS) groups[g.title] = [];

  for (const item of items) {
    const match = SUBGROUP_MATCHERS.find((g) => g.test(item.label));
    groups[match ? match.title : "Valuation / Outros"].push(item);
  }
  return groups;
}

function IndicatorGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, i) => {
        const tone = classifyIndicator(item.label, item.value);
        return (
          <div key={`${item.label}-${i}`}>
            <div className="text-xs text-text-muted">{item.label}</div>
            <div className={`text-sm font-medium ${TONE_CLASS[tone]}`}>{item.value || "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

export function FullIndicatorsPanel({ sections }: { sections: FundamentusSection[] }) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => {
        if (section.title !== "Indicadores Fundamentalistas") {
          return (
            <div key={section.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{section.title}</h3>
              <IndicatorGrid items={section.items} />
            </div>
          );
        }

        const groups = splitIndicadoresFundamentalistas(section.items);
        return (
          <div key={section.title} className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{section.title}</h3>
            {Object.entries(groups)
              .filter(([, items]) => items.length > 0)
              .map(([title, items]) => (
                <div key={title} className="rounded border border-border/60 bg-panel-alt/40 p-3">
                  <h4 className="mb-2 text-xs font-medium text-gold-bright">{title}</h4>
                  <IndicatorGrid items={items} />
                </div>
              ))}
          </div>
        );
      })}
      <p className="text-xs text-text-muted">
        Via Fundamentus.com.br — todos os indicadores disponíveis na fonte. Cores são leitura rápida
        (verde = saudável, amarelo = atenção, vermelho = fora do ideal) baseada em limiares gerais de
        mercado, não é recomendação de compra/venda e não substitui análise por setor.
      </p>
    </div>
  );
}
