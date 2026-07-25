import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { b3FlowDaily } from "@/lib/db/schema";
import { getFlowHistory, type FlowDayRaw } from "@/lib/sources/b3Flow";

const SEGMENT_KEYS: { key: keyof Omit<FlowDayRaw, "date">; segment: string }[] = [
  { key: "foreigners", segment: "Estrangeiro" },
  { key: "institutional", segment: "Institucional" },
  { key: "individuals", segment: "Pessoa Física" },
  { key: "financialInstitutions", segment: "Inst. Financeira" },
  { key: "other", segment: "Outros" },
];

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json({ persisted: false, reason: "DATABASE_URL não configurada" });
  }

  const history = await getFlowHistory();
  const db = getDb();

  const rows = history.flatMap((day) =>
    SEGMENT_KEYS.map(({ key, segment }) => ({
      date: day.date,
      segment,
      netValueBRL: day[key],
      source: "dadosdemercado.com.br",
    }))
  );

  await db
    .insert(b3FlowDaily)
    .values(rows)
    .onConflictDoUpdate({
      target: [b3FlowDaily.date, b3FlowDaily.segment],
      set: { netValueBRL: sql`excluded.net_value_brl` },
    });

  return NextResponse.json({ persisted: true, rows: rows.length });
}
