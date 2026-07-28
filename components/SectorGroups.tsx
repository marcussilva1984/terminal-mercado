"use client";

import { useState } from "react";
import Link from "next/link";
import { changeColorClass, formatPct } from "@/lib/format";
import type { B3SectorGroup } from "@/lib/sources/brapi";

export function SectorGroups({ groups }: { groups: B3SectorGroup[] }) {
  const [openSector, setOpenSector] = useState<string | null>(groups[0]?.sector ?? null);

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        <div key={g.sector} className="rounded border border-border/60 bg-panel-alt/40">
          <button
            onClick={() => setOpenSector(openSector === g.sector ? null : g.sector)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left"
          >
            <span className="text-sm font-medium text-text">
              {g.sector} <span className="text-xs text-text-muted">({g.count} papéis)</span>
            </span>
            <span className={`text-sm font-medium ${changeColorClass(g.avgChangePct)}`}>{formatPct(g.avgChangePct)}</span>
          </button>
          {openSector === g.sector && (
            <div className="border-t border-border/60 px-3 py-2">
              <ul className="flex flex-col divide-y divide-border/50">
                {g.stocks.map((s) => (
                  <li key={s.symbol} className="flex items-center justify-between py-1.5 text-sm">
                    <Link href={`/ticker/${s.symbol}?class=b3`} className="text-text hover:underline">
                      {s.symbol} <span className="text-xs text-text-muted">{s.name}</span>
                    </Link>
                    <span className={changeColorClass(s.changePct)}>{formatPct(s.changePct)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
