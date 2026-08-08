import type { AlertStatus, AssetClass } from "@/lib/types";
import { B3_WATCHLIST, CRIPTO_WATCHLIST, FII_WATCHLIST, STOCKS_WATCHLIST } from "@/lib/watchlist";

export type AlertCategory = "Oportunidades" | "Ações" | "Cripto" | "Stocks" | "FII" | "Notícias" | "Outros";

const CATEGORY_BY_ASSET_CLASS: Record<AssetClass, AlertCategory> = {
  b3: "Ações",
  cripto: "Cripto",
  stocks: "Stocks",
  fii: "FII",
  forex: "Outros",
  indice: "Outros",
};

// Símbolo -> classe de ativo, a partir dos watchlists padrão + os que o
// usuário cadastrou via /watchlist (passados como `extraSymbols`).
function buildSymbolClassMap(extraSymbols: { symbol: string; assetClass: string }[]): Map<string, AssetClass> {
  const map = new Map<string, AssetClass>();
  for (const w of B3_WATCHLIST) map.set(w.symbol, "b3");
  for (const w of CRIPTO_WATCHLIST) map.set(w.symbol, "cripto");
  for (const w of STOCKS_WATCHLIST) map.set(w.symbol, "stocks");
  for (const w of FII_WATCHLIST) map.set(w.symbol, "fii");
  for (const w of extraSymbols) {
    if (["b3", "cripto", "stocks", "fii"].includes(w.assetClass)) {
      map.set(w.symbol, w.assetClass as AssetClass);
    }
  }
  return map;
}

// Classifica um alerta na mesma categoria das abas do dashboard (Ações,
// Cripto, Stocks, FII) a partir da `key` interna usada pelo cron — que
// carrega o símbolo do ativo (ex.: "zscore:PETR4", "price_target:AAPL").
export function classifyAlert(alert: Pick<AlertStatus, "key" | "kind" | "label">, extraSymbols: { symbol: string; assetClass: string }[]): AlertCategory {
  const { key, kind } = alert;

  if (kind === "oportunidade") return "Oportunidades";
  if (kind === "noticia") return "Notícias";
  if (kind === "fluxo" || kind === "fato_relevante") return "Ações";

  const symbolMap = buildSymbolClassMap(extraSymbols);

  if (key.startsWith("price_target:")) {
    const symbol = key.slice("price_target:".length);
    return symbol.endsWith(".SA") ? "Ações" : "Stocks";
  }

  if (key.startsWith("zscore:") || key.startsWith("watchlist:")) {
    const symbol = key.split(":")[1] ?? "";
    const cls = symbolMap.get(symbol);
    return cls ? CATEGORY_BY_ASSET_CLASS[cls] : "Outros";
  }

  if (key.startsWith("price:")) {
    // Alerta de preço da carteira: sem símbolo na key, mas o label sempre
    // traz "(SÍMBOLO)" — extrai de lá.
    const match = alert.label.match(/\(([A-Z0-9.]+)\)/);
    const symbol = match?.[1]?.replace(".SA", "");
    const cls = symbol ? symbolMap.get(symbol) : undefined;
    return cls ? CATEGORY_BY_ASSET_CLASS[cls] : "Outros";
  }

  return "Outros";
}
