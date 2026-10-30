import { getDb, hasDatabase } from "@/lib/db/client";
import { forexPolicyRates } from "@/lib/db/schema";
import { getWeeklyCalendar } from "@/lib/sources/economicCalendar";

export type RateStatus = "confirmado" | "estimado" | "manual";

export interface PolicyRate {
  currency: string;
  rate: number;
  status: RateStatus;
  source: string;
  confirmedAt: string;
}

export interface RateChange {
  currency: string;
  from: number | null;
  to: number;
  status: RateStatus;
}

export const STALE_RATE_DAYS = 60;

// Usado só sem banco configurado (dev local sem DATABASE_URL).
const FALLBACK_RATES: PolicyRate[] = [
  { currency: "AUD", rate: 4.6, status: "manual", source: "Fallback (RBA 29/09/2026)", confirmedAt: "2026-09-29T04:30:00Z" },
  { currency: "USD", rate: 4.0, status: "manual", source: "Fallback (Fed 28/10/2026)", confirmedAt: "2026-10-28T18:00:00Z" },
  { currency: "GBP", rate: 3.75, status: "manual", source: "Fallback (BoE 17/09/2026)", confirmedAt: "2026-09-17T11:00:00Z" },
  { currency: "NZD", rate: 3.0, status: "manual", source: "Fallback (RBNZ 28/10/2026)", confirmedAt: "2026-10-28T01:00:00Z" },
  { currency: "EUR", rate: 2.65, status: "manual", source: "Fallback (BCE 29/10/2026)", confirmedAt: "2026-10-29T13:15:00Z" },
  { currency: "CAD", rate: 2.5, status: "manual", source: "Fallback (BoC 28/10/2026)", confirmedAt: "2026-10-28T13:45:00Z" },
  { currency: "JPY", rate: 1.0, status: "manual", source: "Fallback (BoJ jul/2026)", confirmedAt: "2026-07-31T03:00:00Z" },
  { currency: "CHF", rate: 0.0, status: "manual", source: "Fallback (SNB 24/09/2026)", confirmedAt: "2026-09-24T07:30:00Z" },
];

// Títulos exatos das decisões de juros no feed do ForexFactory, por moeda.
const RATE_EVENT_TITLES: Record<string, RegExp> = {
  USD: /^Federal Funds Rate$/i,
  EUR: /^Main Refinancing Rate$/i,
  GBP: /^Official Bank Rate$/i,
  JPY: /^BOJ Policy Rate$/i,
  AUD: /^Cash Rate$/i,
  NZD: /^Official Cash Rate$/i,
  CAD: /^Overnight Rate$/i,
  CHF: /^SNB Policy Rate$/i,
};

// "<1.25%" (formato que o feed usa pro BoJ) é ambíguo — melhor não gravar nada.
function parsePct(value: string): number | null {
  const v = value.trim();
  if (!v || /[<>]/.test(v)) return null;
  const n = parseFloat(v.replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

export async function getPolicyRates(): Promise<PolicyRate[]> {
  if (!hasDatabase()) return FALLBACK_RATES;
  try {
    const rows = await getDb().select().from(forexPolicyRates);
    const fromDb: PolicyRate[] = rows.map((r) => ({
      currency: r.currency,
      rate: r.rate,
      status: r.status as RateStatus,
      source: r.source,
      confirmedAt: r.confirmedAt.toISOString(),
    }));
    const missing = FALLBACK_RATES.filter((f) => !fromDb.some((d) => d.currency === f.currency));
    return [...fromDb, ...missing].sort((a, b) => b.rate - a.rate);
  } catch (e) {
    console.error("forex_policy_rates indisponível, usando fallback:", e);
    return FALLBACK_RATES;
  }
}

export function ratesToMap(rates: PolicyRate[]): Record<string, number> {
  return Object.fromEntries(rates.map((r) => [r.currency, r.rate]));
}

export function rateAgeDays(rate: PolicyRate): number {
  return Math.floor((Date.now() - new Date(rate.confirmedAt).getTime()) / 86_400_000);
}

// Reunião futura na semana: "previous" é a taxa vigente → confirmado.
// Reunião que já passou: o feed não tem o resultado, só o consenso → estimado,
// e a próxima reunião (6–8 semanas depois) confirma pelo "previous".
export async function refreshPolicyRatesFromCalendar(): Promise<RateChange[]> {
  if (!hasDatabase()) return [];
  const [events, current] = await Promise.all([getWeeklyCalendar(), getPolicyRates()]);
  const byCurrency = new Map(current.map((r) => [r.currency, r]));
  const changes: RateChange[] = [];
  const db = getDb();
  const now = new Date();

  for (const [currency, titleRe] of Object.entries(RATE_EVENT_TITLES)) {
    const event = events.find((e) => e.country === currency && titleRe.test(e.title.trim()));
    if (!event) continue;

    const eventDate = new Date(event.date);
    const dateLabel = eventDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    const row = byCurrency.get(currency);
    const rowFromDb = row && !row.source.startsWith("Fallback");

    let next: { rate: number; status: RateStatus; source: string; confirmedAt: Date } | null = null;

    if (eventDate > now) {
      const prev = parsePct(event.previous);
      if (prev !== null) {
        next = { rate: prev, status: "confirmado", source: `Calendário: taxa vigente antes da reunião de ${dateLabel}`, confirmedAt: now };
      }
    } else if (!rowFromDb || new Date(row!.confirmedAt) < eventDate) {
      const estimate = parsePct(event.forecast) ?? parsePct(event.previous);
      if (estimate !== null) {
        next = {
          rate: estimate,
          status: "estimado",
          source: `Calendário: consenso da reunião de ${dateLabel} (o feed não traz o resultado oficial)`,
          confirmedAt: eventDate,
        };
      }
    }

    if (!next) continue;

    await db
      .insert(forexPolicyRates)
      .values({ currency, ...next, updatedAt: now })
      .onConflictDoUpdate({ target: forexPolicyRates.currency, set: { ...next, updatedAt: now } });

    if (!row || row.rate !== next.rate) {
      changes.push({ currency, from: row?.rate ?? null, to: next.rate, status: next.status });
    }
  }

  return changes;
}
