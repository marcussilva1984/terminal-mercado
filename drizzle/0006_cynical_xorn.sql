CREATE TABLE "portfolio_closed_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"label" text NOT NULL,
	"quantity" real NOT NULL,
	"avg_price" real NOT NULL,
	"sell_price" real NOT NULL,
	"notes" text,
	"opened_at" timestamp NOT NULL,
	"closed_at" timestamp DEFAULT now() NOT NULL
);
