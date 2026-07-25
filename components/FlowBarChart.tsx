"use client";

import { useState } from "react";
import type { FlowChartData } from "@/lib/semaphore";
import type { FlowSegment } from "@/lib/types";
import { formatBRLCompact } from "@/lib/format";

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function FlowBarChart({ segments }: { segments: FlowChartData[] }) {
  const [selected, setSelected] = useState(segments[0]?.segment);
  const data = segments.find((s) => s.segment === selected) ?? segments[0];
  if (!data) return null;

  const maxAbs = Math.max(...data.days.map((d) => Math.abs(d.value)), 1);
  const barAreaHeight = 90;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as FlowSegment["segment"])}
          className="rounded border border-border bg-panel-alt px-2 py-1 text-xs text-text"
        >
          {segments.map((s) => (
            <option key={s.segment} value={s.segment}>
              {s.segment}
            </option>
          ))}
        </select>
        <div className="flex gap-4 text-xs text-text-muted">
          <span>
            Semana: <span className={data.weekBRL >= 0 ? "text-up" : "text-down"}>{formatBRLCompact(data.weekBRL)}</span>
          </span>
          <span>
            Mês: <span className={data.monthBRL >= 0 ? "text-up" : "text-down"}>{formatBRLCompact(data.monthBRL)}</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max items-end gap-1" style={{ height: barAreaHeight * 2 + 20 }}>
          {data.days.map((d) => {
            const heightPx = (Math.abs(d.value) / maxAbs) * barAreaHeight;
            const positive = d.value >= 0;
            return (
              <div key={d.date} className="flex w-6 flex-col items-center" title={`${formatDayLabel(d.date)}: ${formatBRLCompact(d.value)}`}>
                <div className="flex flex-col justify-end" style={{ height: barAreaHeight }}>
                  {positive && <div className="w-4 rounded-t bg-up" style={{ height: heightPx }} />}
                </div>
                <div className="h-px w-full bg-border" />
                <div className="flex flex-col justify-start" style={{ height: barAreaHeight }}>
                  {!positive && <div className="w-4 rounded-b bg-down" style={{ height: heightPx }} />}
                </div>
                <span className="mt-1 rotate-45 text-[9px] text-text-muted">{formatDayLabel(d.date)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
