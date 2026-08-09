import { pgTable, serial, text, real, date, timestamp, uniqueIndex, unique, jsonb } from "drizzle-orm/pg-core";

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    assetClass: text("asset_class").notNull(), // 'b3' | 'cripto'
    label: text("label").notNull(),
    active: text("active").notNull().default("true"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("watchlist_items_symbol_asset_class_key").on(table.symbol, table.assetClass)]
);

export const priceSeries = pgTable(
  "price_series",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    assetClass: text("asset_class").notNull(), // 'b3' | 'cripto'
    date: date("date").notNull(),
    closePrice: real("close_price").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("price_series_symbol_date_idx").on(table.symbol, table.assetClass, table.date)]
);

export const b3FlowDaily = pgTable(
  "b3_flow_daily",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    segment: text("segment").notNull(),
    netValueBRL: real("net_value_brl").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("b3_flow_daily_date_segment_idx").on(table.date, table.segment)]
);

// Registro de todo alerta disparado (também alimenta o painel "Alertas" da Home).
// `key` identifica a regra+condição (ex.: "flow:Estrangeiro:vermelho",
// "zscore:PETR4") e é usado para não notificar a mesma condição repetidamente.
export const alertLog = pgTable("alert_log", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  kind: text("kind").notNull(), // 'fluxo' | 'zscore' | 'watchlist' | 'preco' | 'noticia' | 'fato_relevante'
  url: text("url"), // link pra fonte original (notícia, documento CVM etc.), quando existir
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
});

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  assetClass: text("asset_class").notNull(), // 'b3' | 'cripto' | 'fii' | 'stocks'
  label: text("label").notNull(),
  direction: text("direction").notNull(), // 'above' | 'below'
  targetPrice: real("target_price").notNull(),
  active: text("active").notNull().default("true"),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Cache dos dados de derivativos (Binance Futures) — a Vercel bloqueia esse
// fetch quando feito de dentro da própria infra (serverless-to-serverless
// ou até direto, aparentemente bloqueio de IP da Binance pro range da
// Vercel). Um job externo (GitHub Actions, fora da rede da Vercel) busca o
// dado já validado como funcionando e grava aqui; a página só lê daqui.
export const derivativesCache = pgTable("derivatives_cache", {
  id: serial("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Posições fechadas — guarda a tese original (copiada de portfolio_holdings
// no momento do fechamento) junto do resultado real, pra comparar depois se
// a tese bateu ou não.
export const portfolioClosedPositions = pgTable("portfolio_closed_positions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  assetClass: text("asset_class").notNull(),
  label: text("label").notNull(),
  quantity: real("quantity").notNull(),
  avgPrice: real("avg_price").notNull(),
  sellPrice: real("sell_price").notNull(),
  notes: text("notes"),
  openedAt: timestamp("opened_at").notNull(),
  closedAt: timestamp("closed_at").notNull().defaultNow(),
});

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  assetClass: text("asset_class").notNull(), // 'b3' | 'cripto' | 'fii' | 'stocks'
  label: text("label").notNull(),
  quantity: real("quantity").notNull(),
  avgPrice: real("avg_price").notNull(),
  // Tese de investimento — por que comprou, o que espera. Histórico de decisão
  // pra revisar acerto/erro depois, prática comum em mesa institucional.
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
