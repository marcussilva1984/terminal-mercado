"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Resumo do Dia" },
  { href: "/noticias", label: "Notícias" },
  { href: "/acoes", label: "Ações (B3)" },
  { href: "/cripto", label: "Cripto" },
  { href: "/stocks", label: "Stocks (EUA)" },
  { href: "/forex", label: "Forex" },
  { href: "/fii", label: "FII" },
  { href: "/carteira", label: "Minha Carteira" },
  { href: "/watchlist", label: "Watchlist" },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b border-border bg-panel-alt">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-gold text-gold-bright"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
