export type AssetClass = "b3" | "cripto" | "stocks" | "fii" | "forex" | "indice";

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
  price?: number; // usado quando `value` é outra grandeza (ex.: market cap) e o preço do ativo precisa aparecer também
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
  key: string;
  label: string;
  triggeredAt: string;
  kind: "fluxo" | "watchlist" | "zscore" | "preco" | "noticia" | "fato_relevante" | "oportunidade";
  url?: string | null;
}

export interface DataSourceStatus {
  available: boolean;
  updatedAt: string;
  note?: string;
}
