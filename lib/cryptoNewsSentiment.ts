import { getNews } from "@/lib/sources/rss";

// Mesma heurística por palavra-chave já usada pro setor Agro (não é IA/NLP,
// não é sentimento de verdade) — conta manchetes recentes de cripto que
// citam o ativo E carregam algum termo de tom negativo. Reaproveita a lista
// de termos "de crise real" já usada pra priorizar notícias (hack, fraude,
// colapso, processo etc.) — cobre bem o vocabulário típico de más notícias
// em cripto.
const NEGATIVE_WORDS =
  /crash|collapse|colaps[ao]|quebr[ao]u?|calote|default|falência|bankrupt|fraude|fraud|hack(ed|eado)?|invasão|invaded|breach|exploit|rug ?pull|processo|lawsuit|sec (sues|charges|investigation)|investiga(ção|tion)|delist(ing|ado)?|congela(mento|dos)|liquidação forçada|liquidated|despenca|desaba|tomba|afunda|plunge|plummet|tank(s|ed)?|bear market/i;

export interface CryptoAssetSignal {
  symbol: string;
  label: string;
  count: number;
  sampleTitles: string[];
}

function buildAssetPattern(symbol: string, label: string): RegExp | null {
  const parts = [symbol];
  // Label só entra na busca se for um nome de verdade (não o próprio
  // ticker repetido em minúsculo, que é o que fica quando o ativo foi
  // cadastrado sem nome — buscar por isso geraria falso positivo constante).
  if (label && label.toUpperCase() !== symbol.toUpperCase() && label.length >= 3) {
    parts.push(label);
  }
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
}

// Varre notícias de cripto dos últimos `days` dias — conta quantas citam
// cada ativo da watchlist E têm tom de crise/má notícia pelo léxico acima.
export async function getNegativeCryptoSignals(
  watchlist: { symbol: string; label: string }[],
  days = 7
): Promise<CryptoAssetSignal[]> {
  const news = await getNews("cripto", 200);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = news.filter((n) => new Date(n.publishedAt).getTime() >= since);

  const signals: CryptoAssetSignal[] = [];
  for (const { symbol, label } of watchlist) {
    const pattern = buildAssetPattern(symbol, label);
    if (!pattern) continue;
    const matches = recent.filter((n) => pattern.test(n.title) && NEGATIVE_WORDS.test(n.title));
    if (matches.length > 0) {
      signals.push({ symbol, label, count: matches.length, sampleTitles: matches.slice(0, 3).map((m) => m.title) });
    }
  }
  return signals.sort((a, b) => b.count - a.count);
}
