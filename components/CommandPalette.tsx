"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { B3_WATCHLIST, CRIPTO_WATCHLIST, FII_WATCHLIST, STOCKS_WATCHLIST, FOREX_WATCHLIST } from "@/lib/watchlist";

interface WatchlistHit {
  symbol: string;
  assetClass: string;
  label: string;
}

// Quick-jump estilo terminal (Ctrl+K ou Cmd+K) — digita o ticker, aperta
// enter, vai direto pra página de fundamentalista/gráfico dele. Lista vem da
// mesma watchlist que já alimenta z-score/oportunidades, sem fonte nova.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WatchlistHit[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    if (items) return;
    // Padrões hardcoded entram sempre, mesmo que o banco do usuário (por
    // algum motivo histórico) não tenha esse símbolo específico salvo — a
    // busca rápida não deve "esquecer" um ticker central como MXRF11 só
    // porque ele nunca foi reinserido no watchlist_items.
    const defaults: WatchlistHit[] = [
      ...B3_WATCHLIST.map((w) => ({ ...w, assetClass: "b3" })),
      ...CRIPTO_WATCHLIST.map((w) => ({ ...w, assetClass: "cripto" })),
      ...FII_WATCHLIST.map((w) => ({ ...w, assetClass: "fii" })),
      ...STOCKS_WATCHLIST.map((w) => ({ ...w, assetClass: "stocks" })),
      ...FOREX_WATCHLIST.map((w) => ({ ...w, assetClass: "forex" })),
    ];
    try {
      const res = await fetch("/api/watchlist");
      const json = await res.json();
      const fromDb: WatchlistHit[] = json.available
        ? json.data.map((d: WatchlistHit) => ({ symbol: d.symbol, assetClass: d.assetClass, label: d.label }))
        : [];
      const seen = new Set(fromDb.map((d) => `${d.assetClass}-${d.symbol}`));
      const merged = [...fromDb, ...defaults.filter((d) => !seen.has(`${d.assetClass}-${d.symbol}`))];
      setItems(merged);
    } catch {
      setItems(defaults);
    }
  }, [items]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onExternalOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onExternalOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onExternalOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      loadItems();
      setQuery("");
      setActiveIndex(0);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- foco só depois de montar o input
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, loadItems]);

  if (!open) return null;

  const filtered = (items ?? []).filter(
    (i) =>
      i.symbol.toUpperCase().includes(query.toUpperCase()) || i.label.toUpperCase().includes(query.toUpperCase())
  ).slice(0, 20);

  function go(hit: WatchlistHit) {
    setOpen(false);
    router.push(`/ticker/${hit.symbol}?class=${hit.assetClass}`);
  }

  function onKeyDownInput(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      go(filtered[activeIndex]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDownInput}
          placeholder="Digite um ticker da watchlist (ex.: PETR4, MXRF11, AAPL)…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-text outline-none"
        />
        <div className="max-h-80 overflow-y-auto">
          {items === null ? (
            <p className="px-4 py-3 text-sm text-text-muted">Carregando watchlist…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">Nenhum ativo encontrado na watchlist.</p>
          ) : (
            filtered.map((hit, i) => (
              <button
                key={`${hit.assetClass}-${hit.symbol}`}
                onClick={() => go(hit)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  i === activeIndex ? "bg-panel-alt text-gold-bright" : "text-text"
                }`}
              >
                <span>
                  {hit.symbol} <span className="text-xs text-text-muted">— {hit.label}</span>
                </span>
                <span className="text-xs uppercase text-text-muted">{hit.assetClass}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-4 py-2 text-xs text-text-muted">
          ↑↓ navegar · Enter ir · Esc fechar
        </div>
      </div>
    </div>
  );
}
