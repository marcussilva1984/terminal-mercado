export interface WatchlistEntry {
  symbol: string;
  label: string;
}

// Watchlist padrão do MVP (ainda sem UI de edição — watchlist_items no banco fica
// pronta para uma fase futura). B3 limitado aos 4 tickers livres da brapi.dev sem
// token; adicionar mais exige BRAPI_TOKEN.
export const B3_WATCHLIST: WatchlistEntry[] = [
  { symbol: "PETR4", label: "Petrobras PN" },
  { symbol: "VALE3", label: "Vale ON" },
  { symbol: "MGLU3", label: "Magazine Luiza ON" },
  { symbol: "ITUB4", label: "Itaú Unibanco PN" },
];

export const CRIPTO_WATCHLIST: WatchlistEntry[] = [
  { symbol: "BTC", label: "Bitcoin" },
  { symbol: "ETH", label: "Ethereum" },
  { symbol: "SOL", label: "Solana" },
  { symbol: "SUI", label: "Sui" },
  { symbol: "JTO", label: "Jito" },
];

export const CRIPTO_COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  SUI: "sui",
  JTO: "jito-governance-token",
};

export const STOCKS_WATCHLIST: WatchlistEntry[] = [
  { symbol: "NVDA", label: "NVIDIA" },
  { symbol: "TSLA", label: "Tesla" },
  { symbol: "AAPL", label: "Apple" },
  { symbol: "MSFT", label: "Microsoft" },
  { symbol: "MARA", label: "Marathon Digital" },
  { symbol: "RIOT", label: "Riot Platforms" },
  { symbol: "BMNR", label: "Bitmine Immersion" },
  { symbol: "BTBT", label: "Bit Digital" },
  { symbol: "BTCS", label: "BTCS Inc." },
  { symbol: "SBET", label: "SharpLink Gaming" },
];

export const US_INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^RUT", label: "Russell 2000" },
  { symbol: "^VIX", label: "VIX" },
];
