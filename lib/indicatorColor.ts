// Classificação de cor pra indicadores fundamentalistas — heurística simples
// (bom/atenção/ruim) só pra dar leitura visual rápida, não é recomendação.
// Os limiares são referências gerais de mercado, não regra fixa por setor.

export type IndicatorTone = "good" | "warning" | "bad" | "neutral";

export const TONE_CLASS: Record<IndicatorTone, string> = {
  good: "text-up",
  warning: "text-amber",
  bad: "text-down",
  neutral: "text-text",
};

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, "").replace(",", ".").replace("%", "").trim();
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

// Espera o valor já como % (ex.: margem, ROE, dividend yield).
function classifyPct(value: number, goodAbove: number, warningAbove: number): IndicatorTone {
  if (value < 0) return "bad";
  if (value >= goodAbove) return "good";
  if (value >= warningAbove) return "warning";
  return "bad";
}

export function classifyIndicator(label: string, rawValue: string): IndicatorTone {
  const value = parseNumber(rawValue);
  if (value === null) return "neutral";

  const l = label.toLowerCase();

  if (l.includes("marg") || l.includes("roe") || l.includes("roic") || l.includes("roa") || l.includes("ebit / ativo")) {
    return classifyPct(value, 15, 5);
  }
  if (l.includes("div. yield") || l.includes("div yield") || l.includes("dividend yield")) {
    return classifyPct(value, 6, 3);
  }
  if (l.includes("liquidez corr")) {
    if (value >= 1.5) return "good";
    if (value >= 1) return "warning";
    return "bad";
  }
  if (l.includes("dív") && l.includes("patrim")) {
    if (value < 0) return "good"; // caixa líquido (dívida líquida negativa)
    // Fundamentus mostra como razão (ex.: 0,8); o Yahoo (debtToEquity) mostra
    // como percentual (ex.: 80%) — normaliza pra mesma escala de razão antes
    // de aplicar o limiar.
    const ratio = value > 5 ? value / 100 : value;
    if (ratio <= 0.5) return "good";
    if (ratio <= 1) return "warning";
    return "bad";
  }

  return "neutral";
}
