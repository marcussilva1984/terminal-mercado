// Backfill inicial de histórico de preços para o z-score (30 pregões).
// Uso: npm run backfill (precisa de DATABASE_URL configurada em .env.local)
import { config } from "dotenv";
config({ path: ".env.local" });
import { hasDatabase } from "../lib/db/client";
import { upsertCloses, type PriceSeriesRow } from "../lib/db/priceSeriesRepo";
import { getBrapiHistory } from "../lib/sources/brapi";
import { getCoinHistory } from "../lib/sources/coingecko";
import { B3_WATCHLIST, CRIPTO_COINGECKO_IDS, CRIPTO_WATCHLIST } from "../lib/watchlist";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!hasDatabase()) {
    console.error("DATABASE_URL não configurada. Configure .env.local antes de rodar o backfill.");
    process.exit(1);
  }

  console.log(`Backfill B3 (${B3_WATCHLIST.length} ativos)...`);
  for (const { symbol } of B3_WATCHLIST) {
    try {
      const history = await getBrapiHistory(symbol, "3mo");
      const rows: PriceSeriesRow[] = history.map((h) => ({
        symbol,
        assetClass: "b3",
        date: h.date,
        closePrice: h.close,
        source: "brapi.dev",
      }));
      await upsertCloses(rows);
      console.log(`  ${symbol}: ${rows.length} pregões salvos`);
    } catch (err) {
      console.error(`  ${symbol}: falhou —`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Backfill Cripto (${CRIPTO_WATCHLIST.length} ativos)...`);
  for (const { symbol } of CRIPTO_WATCHLIST) {
    const coinId = CRIPTO_COINGECKO_IDS[symbol];
    try {
      const history = await getCoinHistory(coinId, 90);
      const rows: PriceSeriesRow[] = history.map((h) => ({
        symbol,
        assetClass: "cripto",
        date: h.date,
        closePrice: h.close,
        source: "coingecko",
      }));
      await upsertCloses(rows);
      console.log(`  ${symbol}: ${rows.length} dias salvos`);
    } catch (err) {
      console.error(`  ${symbol}: falhou —`, err instanceof Error ? err.message : err);
    }
    await sleep(15_000); // evita rate limit (429) da CoinGecko no plano grátis
  }

  console.log("Backfill concluído.");
  process.exit(0);
}

main();
