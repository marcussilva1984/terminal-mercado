import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TickerTape } from "@/components/TickerTape";
import { TabNav } from "@/components/TabNav";
import { getRealTickerQuotes } from "@/lib/tickerService";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Terminal de Mercado",
  description: "Dashboard de mercado — B3, Cripto, Stocks, Forex e FII",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tickerQuotes = await getRealTickerQuotes().catch(() => []);

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        <TickerTape quotes={tickerQuotes} />
        <TabNav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
