"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TABS = [
  { href: "/", label: "Resumo do Dia" },
  { href: "/noticias", label: "Notícias" },
  { href: "/acoes", label: "Ações (B3)" },
  { href: "/cripto", label: "Cripto" },
  { href: "/stocks", label: "Stocks (EUA)" },
  { href: "/forex", label: "Forex" },
  { href: "/fii", label: "FII" },
  { href: "/ticker/PETR4?class=b3", label: "Fundamentalista", matchPrefix: "/ticker" },
  { href: "/comparador", label: "Comparador" },
  { href: "/carteira", label: "Minha Carteira" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/alertas", label: "Alertas" },
  { href: "/oportunidades", label: "Oportunidades" },
];

export function TabNav() {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Com 13 abas + busca, a barra estoura a largura da tela em mobile e vira
  // scroll horizontal — sem pista visual disso, dá a impressão de que a aba
  // que você quer (ex.: Watchlist, Alertas) simplesmente não existe/não
  // clica. Rola a aba ativa pro centro ao trocar de página, pelo menos
  // garantindo que "onde você está" sempre aparece na tela.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav className="relative w-full border-b border-border bg-panel-alt">
      <div
        ref={scrollerRef}
        className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4"
        style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
      >
        {TABS.map((tab) => {
          const matchAgainst = tab.matchPrefix ?? tab.href;
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(matchAgainst);
          return (
            <Link
              key={tab.href}
              ref={active ? activeRef : undefined}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-gold text-gold-bright"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
              style={{ scrollSnapAlign: "start" }}
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="ml-auto shrink-0 whitespace-nowrap rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text"
          title="Busca rápida (Ctrl+K)"
        >
          🔍 <span className="hidden sm:inline">Ctrl+K</span>
        </button>
      </div>
      {/* Sinaliza visualmente que dá pra arrastar pros lados — some sozinho
          quando não há mais overflow (telas largas), via CSS puro. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-panel-alt to-transparent sm:hidden" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-panel-alt to-transparent sm:hidden" />
    </nav>
  );
}
