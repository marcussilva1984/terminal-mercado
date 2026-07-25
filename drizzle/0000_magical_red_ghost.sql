CREATE TABLE "b3_flow_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"segment" text NOT NULL,
	"net_value_brl" real NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"date" date NOT NULL,
	"close_price" real NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"label" text NOT NULL,
	"active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "b3_flow_daily_date_segment_idx" ON "b3_flow_daily" USING btree ("date","segment");--> statement-breakpoint
CREATE UNIQUE INDEX "price_series_symbol_date_idx" ON "price_series" USING btree ("symbol","asset_class","date");