export type AssetClass = "b3" | "cripto" | "stocks" | "forex" | "indice";

export interface Quote {
  symbol: string;
  label: string;
  price: number;
  changePct: number;
  assetClass: AssetClass;
  currency?: string;
  updatedAt: string;
}

export interface RankingItem {
  symbol: string;
  label: string;
  value: number;
  changePct: number;
  volume?: number;
}

export interface ZScoreHighlight {
  symbol: string;
  label: string;
  changePct: number;
  zScore: number;
  assetClass: AssetClass;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

export type FlowSignal = "verde" | "amarelo" | "vermelho";

export interface FlowSegment {
  segment: "Estrangeiro" | "Institucional" | "Pessoa Física" | "Inst. Financeira" | "Outros";
  dailyBRL: number;
  monthBRL: number;
  yearBRL: number;
  signal: FlowSignal;
  reading: string;
  note?: string;
}

export interface AlertStatus {
  label: string;
  triggeredAt: string;
  kind: "fluxo" | "watchlist" | "zscore" | "preco";
}

export interface DataSourceStatus {
  available: boolean;
  updatedAt: string;
  note?: string;
}
