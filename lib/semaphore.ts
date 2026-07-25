import type { FlowDayRaw } from "@/lib/sources/b3Flow";
import type { FlowSegment, FlowSignal } from "@/lib/types";
import { formatBRLCompact } from "@/lib/format";

// Sinal do semáforo: verde se comprou 3+ pregões seguidos, vermelho se vendeu
// 3+ seguidos, âmbar se misto. `values` deve estar em ordem cronológica ascendente.
export function computeSignal(values: number[]): FlowSignal {
  const lastThree = values.slice(-3);
  if (lastThree.length < 3) return "amarelo";
  if (lastThree.every((v) => v > 0)) return "verde";
  if (lastThree.every((v) => v < 0)) return "vermelho";
  return "amarelo";
}

function sumInMonth(rows: { date: string; value: number }[], year: number, month: number): number {
  return rows
    .filter((r) => {
      const d = new Date(r.date);
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    })
    .reduce((acc, r) => acc + r.value, 0);
}

function sumInYear(rows: { date: string; value: number }[], year: number): number {
  return rows
    .filter((r) => new Date(r.date).getUTCFullYear() === year)
    .reduce((acc, r) => acc + r.value, 0);
}

// Segunda-feira (UTC) da semana da última data disponível.
function startOfWeek(dateISO: string): Date {
  const d = new Date(dateISO);
  const day = d.getUTCDay(); // 0 = domingo
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function sumSinceWeekStart(rows: { date: string; value: number }[], weekStart: Date): number {
  return rows
    .filter((r) => new Date(r.date).getTime() >= weekStart.getTime())
    .reduce((acc, r) => acc + r.value, 0);
}

function buildReading(segment: string, dailyBRL: number, monthBRL: number, signal: FlowSignal): string {
  const verb = dailyBRL >= 0 ? "comprou" : "vendeu";
  const trend =
    signal === "verde"
      ? "e mantém entrada"
      : signal === "vermelho"
        ? "e mantém saída"
        : "com fluxo misto";
  return `${segment} ${verb} ${formatBRLCompact(Math.abs(dailyBRL)).replace(/^[+-] /, "")} no pregão, ${trend} de ${formatBRLCompact(monthBRL)} no mês.`;
}

export const SEGMENT_CONFIG: {
  key: keyof Omit<FlowDayRaw, "date">;
  label: FlowSegment["segment"];
  note?: string;
}[] = [
  { key: "foreigners", label: "Estrangeiro" },
  { key: "institutional", label: "Institucional" },
  { key: "individuals", label: "Pessoa Física" },
  { key: "financialInstitutions", label: "Inst. Financeira" },
  {
    key: "other",
    label: "Outros",
    note: "Proxy: agrega pessoa jurídica, clubes de investimento e demais categorias — a B3 não abre esse detalhamento de graça.",
  },
];

export function buildFlowSegments(history: FlowDayRaw[]): FlowSegment[] {
  const last = history[history.length - 1];
  const now = new Date(last.date);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return SEGMENT_CONFIG.map(({ key, label, note }) => {
    const rows = history.map((h) => ({ date: h.date, value: h[key] }));
    const dailyBRL = rows[rows.length - 1]?.value ?? 0;
    const monthBRL = sumInMonth(rows, year, month);
    const yearBRL = sumInYear(rows, year);
    const signal = computeSignal(rows.map((r) => r.value));

    return {
      segment: label,
      dailyBRL,
      monthBRL,
      yearBRL,
      signal,
      reading: buildReading(label, dailyBRL, monthBRL, signal),
      note,
    };
  });
}

export interface FlowChartDay {
  date: string;
  value: number;
}

export interface FlowChartData {
  segment: FlowSegment["segment"];
  days: FlowChartDay[];
  weekBRL: number;
  monthBRL: number;
}

// Série diária (últimos `days` pregões) + totais da semana e do mês corrente,
// para o infográfico de barras positivo/negativo do fluxo.
export function getFlowChartData(
  history: FlowDayRaw[],
  segmentKey: (typeof SEGMENT_CONFIG)[number]["key"],
  days = 20
): FlowChartData {
  const config = SEGMENT_CONFIG.find((s) => s.key === segmentKey)!;
  const rows = history.map((h) => ({ date: h.date, value: h[segmentKey] }));
  const last = rows[rows.length - 1];
  const now = new Date(last.date);

  return {
    segment: config.label,
    days: rows.slice(-days),
    weekBRL: sumSinceWeekStart(rows, startOfWeek(last.date)),
    monthBRL: sumInMonth(rows, now.getUTCFullYear(), now.getUTCMonth()),
  };
}
