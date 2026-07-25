import { pgTable, serial, text, real, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const watchlistItems = pgTable("watchlist_items", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  assetClass: text("asset_class").notNull(), // 'b3' | 'cripto'
  label: text("label").notNull(),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
