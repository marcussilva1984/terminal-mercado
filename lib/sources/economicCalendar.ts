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

// Só a decisão formal em si (não fala/testemunho de dirigente) — pra
// responder "quando é a próxima reunião", não "o que os bancos centrais vão
// falar essa semana" (isso já existe em filterRateDecisions, mais amplo).
const RATE_DECISION_ONLY_PATTERN = /rate decision/i;

export interface NextCentralBankMeeting {
  bank: string;
  country: string;
  date: string | null; // null = sem reunião agendada na janela coberta pela fonte
}

export const CENTRAL_BANKS: { country: string; bank: string }[] = [
  { country: "USD", bank: "Fed (EUA)" },
  { country: "EUR", bank: "BCE (Zona do Euro)" },
  { country: "GBP", bank: "BoE (Reino Unido)" },
  { country: "JPY", bank: "BoJ (Japão)" },
  { country: "CHF", bank: "SNB (Suíça)" },
  { country: "AUD", bank: "RBA (Austrália)" },
  { country: "NZD", bank: "RBNZ (Nova Zelândia)" },
];

// A fonte gratuita (ForexFactory) só cobre a semana corrente — se nenhum
// banco tiver reunião nesse intervalo, date fica null, e a UI deve dizer
// isso explicitamente em vez de sumir com a linha (evita parecer que
// "não tem reunião nenhuma programada" quando na verdade é só que a
// reunião cai fora da janela que essa fonte grátis alcança).
export function getNextCentralBankMeetings(events: CalendarEvent[]): NextCentralBankMeeting[] {
  const upcoming = filterUpcoming(events).filter((e) => RATE_DECISION_ONLY_PATTERN.test(e.title));
  return CENTRAL_BANKS.map(({ country, bank }) => {
    const next = upcoming.find((e) => e.country === country);
    return { bank, country, date: next?.date ?? null };
  });
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
