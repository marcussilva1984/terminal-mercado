import type { CalendarEvent } from "@/lib/sources/economicCalendar";

const FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CHF: "🇨🇭",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CNY: "🇨🇳",
  BRL: "🇧🇷",
};

const IMPACT_STYLE: Record<CalendarEvent["impact"], string> = {
  High: "bg-down/15 text-down border-down/40",
  Medium: "bg-amber/15 text-amber border-amber/40",
  Low: "bg-panel-alt text-text-muted border-border",
  Holiday: "bg-panel-alt text-text-muted border-border",
};

const IMPACT_LABEL: Record<CalendarEvent["impact"], string> = {
  High: "Alto",
  Medium: "Médio",
  Low: "Baixo",
  Holiday: "Feriado",
};

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EconomicCalendar({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-text-muted">Sem eventos relevantes nesta semana.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {events.map((e, i) => (
        <li key={`${e.title}-${e.date}-${i}`} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2 min-w-0">
            <span>{FLAGS[e.country] ?? e.country}</span>
            <div className="min-w-0">
              <div className="truncate text-sm text-text">{e.title}</div>
              <div className="text-xs text-text-muted">{formatEventTime(e.date)}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {(e.forecast || e.previous) && (
              <span className="text-xs text-text-muted">
                {e.forecast && <>prev.: {e.forecast}</>}
                {e.forecast && e.previous && " / "}
                {e.previous && <>ant.: {e.previous}</>}
              </span>
            )}
            <span className={`rounded border px-1.5 py-0.5 text-xs ${IMPACT_STYLE[e.impact]}`}>
              {IMPACT_LABEL[e.impact]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
