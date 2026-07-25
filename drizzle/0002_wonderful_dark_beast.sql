CREATE TABLE "portfolio_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"label" text NOT NULL,
	"quantity" real NOT NULL,
	"avg_price" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
