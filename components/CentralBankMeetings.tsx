import type { NextCentralBankMeeting } from "@/lib/sources/economicCalendar";

export function CentralBankMeetings({ items }: { items: NextCentralBankMeeting[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {items.map((m) => (
        <li key={m.country} className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0">
          <span className="text-text">{m.bank}</span>
          {m.date ? (
            <span className="text-gold-bright">
              {new Date(m.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          ) : (
            <span className="text-xs text-text-muted">Sem reunião nos próximos 7 dias</span>
          )}
        </li>
      ))}
    </ul>
  );
}
