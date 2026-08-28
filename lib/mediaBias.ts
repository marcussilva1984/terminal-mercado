// Classificação de viés editorial por veículo — baseada no AllSides Media
// Bias Chart (allsides.com/media-bias/media-bias-chart), referência pública
// e amplamente citada. NÃO é produção nossa, é rótulo de terceiro que a
// gente repassa — só inclui veículo aqui quando a classificação é estável e
// bem documentada há anos; na dúvida, fica de fora (sem badge) em vez de
// arriscar rotular errado. Cobre majoritariamente "Geral"/"Internacional" —
// imprensa financeira (Valor, InfoMoney, Money Times etc.) não tem
// classificação política nesse sentido, e bancos centrais não são mídia.
export type MediaBias = "Esquerda" | "Centro-Esquerda" | "Centro" | "Centro-Direita" | "Direita";

export const MEDIA_BIAS: Record<string, MediaBias> = {
  "The Guardian": "Esquerda",
  CNN: "Centro-Esquerda",
  "Al Jazeera": "Centro-Esquerda",
  CBC: "Centro-Esquerda",
  "The New York Times": "Centro-Esquerda",
  "The Economist": "Centro-Esquerda",
  BBC: "Centro",
  "AP News": "Centro",
  "WSJ Mundo": "Centro",
  "WSJ Markets": "Centro",
};

export function getMediaBias(source: string): MediaBias | null {
  return MEDIA_BIAS[source] ?? null;
}
