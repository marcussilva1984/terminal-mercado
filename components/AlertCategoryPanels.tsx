"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { AlertStatusList } from "@/components/AlertStatusList";
import type { AlertStatus } from "@/lib/types";
import type { AlertCategory } from "@/lib/alertCategory";

const STORAGE_KEY = "alertas-category-limits";
const DEFAULT_LIMIT = 10;

interface CategoryGroup {
  category: AlertCategory;
  alerts: AlertStatus[];
}

function loadLimits(categories: AlertCategory[]): Record<string, number> {
  const defaults = Object.fromEntries(categories.map((c) => [c, DEFAULT_LIMIT]));
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function AlertCategoryPanels({ groups, now }: { groups: CategoryGroup[]; now: string }) {
  const categories = groups.map((g) => g.category);
  const [limits, setLimits] = useState<Record<string, number>>(() => loadLimits(categories));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no client
    setLimits(loadLimits(categories));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(category: AlertCategory, value: number) {
    const next = { ...limits, [category]: Math.max(1, Math.min(50, value || DEFAULT_LIMIT)) };
    setLimits(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Quantos alertas mostrar por categoria">
        <div className="flex flex-wrap gap-4">
          {groups.map((g) => (
            <label key={g.category} className="flex flex-col gap-1 text-xs text-text-muted">
              {g.category}
              <input
                type="number"
                min={1}
                max={50}
                value={limits[g.category] ?? DEFAULT_LIMIT}
                onChange={(e) => handleChange(g.category, parseInt(e.target.value, 10))}
                className="w-20 rounded border border-border bg-panel-alt px-2 py-1 text-sm text-text"
              />
            </label>
          ))}
        </div>
      </Panel>

      {groups.map((g) => {
        const limit = limits[g.category] ?? DEFAULT_LIMIT;
        const shown = g.alerts.slice(0, limit);
        return (
          <Panel key={g.category} title={`${g.category} (${shown.length} de ${g.alerts.length})`} updatedAt={now}>
            <AlertStatusList alerts={shown} />
          </Panel>
        );
      })}
    </div>
  );
}
