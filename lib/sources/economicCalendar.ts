import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";
export type CalendarImpact = "High" | "Medium" | "Low" | "Holiday";

export interface CalendarEvent {
  title: string;
  country: string;
  date: string; // ISO
  impact: CalendarImpact;
  forecast: string;
  previous: string;
}

const CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

// Mesmo feed público usado pelo widget do ForexFactory (sem chave, sem bloqueio).
// Cobre a semana corrente; dados de bancos centrais, inflação, emprego e PIB dos
// principais países — o que de fato move preço em ações, forex e cripto.
export async function getWeeklyCalendar(): Promise<CalendarEvent[]> {
  const res = await fetch(CALENDAR_URL, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    next: { revalidate: 6 * 60 * 60 },
  });

  if (!res.ok) throw new Error(`Calendário econômico respondeu ${res.status}`);

  const raw: { title: string; country: string; date: string; impact: string; forecast: string; previous: string }[] =
    await res.json();

  return raw.map((e) => ({
    title: e.title,
    country: e.country,
    date: e.date,
    impact: (["High", "Medium", "Low", "Holiday"].includes(e.impact) ? e.impact : "Low") as CalendarImpact,
    forecast: e.forecast,
    previous: e.previous,
  }));
}

// Cobre decisões de juros e falas de dirigentes de bancos centrais (Fed, BCE,
// BoE, BoJ etc.) — ambos costumam mover mercado mesmo sem ser "decisão" formal.
const RATE_DECISION_PATTERN = /rate decision|interest rate|speaks|testimony|press conference/i;

export function filterHighSignal(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((e) => e.impact === "High" || e.impact === "Medium")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function filterRateDecisions(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((e) => RATE_DECISION_PATTERN.test(e.title))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Tira o que já passou — "fique de olho" é sobre o que vem, não histórico.
export function filterUpcoming(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now();
  return events.filter((e) => new Date(e.date).getTime() >= now);
}

// Países das 8 moedas mais operadas em forex — cobre exatamente o que move
// os pares que a aba Forex acompanha (USD/EUR/JPY/GBP/CHF/CAD/AUD/NZD).
const FOREX_COUNTRIES = new Set(["USD", "EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "NZD"]);

export function filterForexRelevant(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => FOREX_COUNTRIES.has(e.country));
}
