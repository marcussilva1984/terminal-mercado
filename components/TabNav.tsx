"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
  matchPrefix?: string;
}

interface TabGroup {
  label: string;
  tabs: Tab[];
}

// Home fica solta (sempre visível); o resto agrupado em dropdowns por tema —
// eram 13 itens numa linha só, ficava difícil de escanear.
const HOME: Tab = { href: "/", label: "Resumo do Dia" };

const GROUPS: TabGroup[] = [
  {
    label: "Mercados",
    tabs: [
      { href: "/noticias", label: "Notícias" },
      { href: "/acoes", label: "Ações (B3)" },
      { href: "/cripto", label: "Cripto" },
      { href: "/stocks", label: "Stocks (EUA)" },
      { href: "/forex", label: "Forex" },
      { href: "/fii", label: "FII" },
    ],
  },
  {
    label: "Análise",
    tabs: [
      { href: "/ticker/PETR4?class=b3", label: "Fundamentalista", matchPrefix: "/ticker" },
      { href: "/comparador", label: "Comparador" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/oportunidades", label: "Oportunidades" },
    ],
  },
  {
    label: "Minha Conta",
    tabs: [
      { href: "/carteira", label: "Minha Carteira" },
      { href: "/alertas", label: "Alertas" },
    ],
  },
];

function isActive(pathname: string, tab: Tab): boolean {
  const matchAgainst = tab.matchPrefix ?? tab.href;
  return tab.href === "/" ? pathname === "/" : pathname.startsWith(matchAgainst);
}

function GroupDropdown({ group, pathname }: { group: TabGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groupActive = group.tabs.some((t) => isActive(pathname, t));

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
          groupActive ? "border-gold text-gold-bright" : "border-transparent text-text-muted hover:text-text"
        }`}
      >
        {group.label} <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 min-w-[180px] rounded-b border border-t-0 border-border bg-panel-alt shadow-lg">
          {group.tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm ${
                isActive(pathname, tab) ? "text-gold-bright" : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b border-border bg-panel-alt">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4">
        <Link
          href={HOME.href}
          className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            isActive(pathname, HOME) ? "border-gold text-gold-bright" : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          {HOME.label}
        </Link>
        {GROUPS.map((group) => (
          <GroupDropdown key={group.label} group={group} pathname={pathname} />
        ))}
        <button
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="ml-auto whitespace-nowrap rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text"
          title="Busca rápida (Ctrl+K)"
        >
          🔍 Buscar <span className="hidden sm:inline">— Ctrl+K</span>
        </button>
      </div>
    </nav>
  );
}
