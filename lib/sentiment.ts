// Classificação por palavras-chave (heurística simples, não é IA/NLP) pra sinalizar
// manchetes de alto impacto — tanto muito boas quanto muito ruins — com destaque
// visual no dashboard. Cobre termos em PT e EN já que os feeds misturam os dois.
const EXTREME_PATTERN =
  /crash|collapse|colaps[ao]|quebr[ao]u?|calote|default|falência|bankrupt|fraude|fraud|hack(ed|eado)?|invasão|invaded|breach|guerra|war|ataque|attack|sanç(ão|ões)|sanction|rebaixamento|downgrade|recessão|recession|crise|crisis|pânico|panic|desaba|despenca|desabou|despencou|tomba|afunda|plunge|plummet|tank(s|ed)?|bear market|liquidação forçada|liquidated|bank run|corrida bancária|insolvência|insolvent|recorde histórico|all-time high|\bath\b|maior alta|maior queda|dispara|disparou|surge[ds]?|soar(s|ed)?|skyrocket|rali histórico|bull run|lucro recorde|salto histórico|recuperação recorde/i;

export function isExtremeNews(title: string): boolean {
  return EXTREME_PATTERN.test(title);
}
