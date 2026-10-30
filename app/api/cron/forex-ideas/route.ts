import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { runForexIdeaTracker } from "@/lib/forexIdeaTracker";
import { notify } from "@/lib/telegramNotify";

export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ checked: false, reason: "DATABASE_URL não configurada" });
  }

  try {
    const events = await runForexIdeaTracker();
    const sent: string[] = [];
    for (const ev of events) {
      if (await notify(ev.key, ev.label, "forex", 24 * 90)) sent.push(ev.label);
    }
    return NextResponse.json({ checked: true, events: events.length, alertsSent: sent.length, sent });
  } catch (e) {
    console.error("forex-ideas cron falhou:", e);
    return NextResponse.json({ checked: false, error: String(e) }, { status: 500 });
  }
}
