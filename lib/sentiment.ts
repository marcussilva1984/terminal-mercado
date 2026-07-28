// Classificação por palavras-chave (heurística simples, não é IA/NLP) pra
// priorizar manchetes em 3 níveis — alta (crise/choque real), média (movimento
// forte mas rotineiro) e baixa (o resto). Cobre termos em PT e EN já que os
// feeds misturam os dois.
const HIGH_PATTERN =
  /crash|collapse|colaps[ao]|quebr[ao]u?|calote|default|falência|bankrupt|fraude|fraud|hack(ed|eado)?|invasão|invaded|breach|guerra|war|ataque|attack|sanç(ão|ões)|sanction|rebaixamento|downgrade|recessão|recession|crise|crisis|pânico|panic|desaba|despenca|desabou|despencou|tomba|afunda|plunge|plummet|tank(s|ed)?|bear market|liquidação forçada|liquidated|bank run|corrida bancária|insolvência|insolvent/i;

const MEDIUM_PATTERN =
  /recorde histórico|all-time high|\bath\b|maior alta|maior queda|dispara|disparou|surge[ds]?|soar(s|ed)?|skyrocket|rali histórico|bull run|lucro recorde|salto histórico|recuperação recorde/i;

export type NewsPriority = "alta" | "media" | "baixa";

export function getNewsPriority(title: string): NewsPriority {
  if (HIGH_PATTERN.test(title)) return "alta";
  if (MEDIUM_PATTERN.test(title)) return "media";
  return "baixa";
}

// Mantido pelo código existente que só precisa do binário (alto impacto ou não).
export function isExtremeNews(title: string): boolean {
  return getNewsPriority(title) !== "baixa";
}
