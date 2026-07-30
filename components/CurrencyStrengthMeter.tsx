"use client";

import { useEffect, useState } from "react";
import type { CurrencyStrength, StrengthPeriod } from "@/lib/forexService";
import { formatNumber } from "@/lib/format";

const PERIOD_OPTIONS: { value: StrengthPeriod; label: string }[] = [
  { value: "1d", label: "1 dia" },
  { value: "1wk", label: "1 semana" },
  { value: "1mo", label: "1 mês" },
];

function Meter({ items }: { items: CurrencyStrength[] }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.score)), 0.01);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const widthPct = (Math.abs(item.score) / maxAbs) * 50;
        const positive = item.score >= 0;
        return (
          <div key={item.currency} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-sm font-medium text-text">{item.currency}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-panel-alt">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute inset-y-0 ${positive ? "left-1/2 bg-up" : "right-1/2 bg-down"}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className={`w-16 shrink-0 text-right text-xs tabular-nums ${positive ? "text-up" : "text-down"}`}>
              {positive ? "+" : ""}
              {formatNumber(item.score)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CurrencyStrengthMeter({ items }: { items: CurrencyStrength[] }) {
  const [period, setPeriod] = useState<StrengthPeriod>("1d");
  const [data, setData] = useState<CurrencyStrength[]>(items);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (period === "1d") {
      setData(items);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/forex/strength?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.available) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? "Fonte indisponível no momento.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Fonte indisponível no momento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, items]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`rounded border px-2 py-0.5 text-xs transition-colors ${
              period === opt.value
                ? "border-gold bg-gold/10 text-gold-bright"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-down">{error}</p>
      ) : (
        <div className={loading ? "opacity-50 transition-opacity" : ""}>
          <Meter items={data} />
        </div>
      )}
    </div>
  );
}
