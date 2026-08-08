import { getNews } from "@/lib/sources/rss";

// Heurística por palavra-chave (não é IA/NLP, não é classificação de sentimento
// de verdade) — conta manchetes recentes que citam o setor E carregam algum
// termo de tom negativo. Serve só como "vale olhar", nunca como confirmação.
// Começa só com Agro (pedido explícito); dá pra adicionar mais setores aqui
// depois, mas cada um precisa de curadoria de termos própria pra não virar ruído.
const SECTOR_KEYWORDS: Record<string, RegExp> = {
  Agro: /agro(neg[oó]cio)?|agr[ií]cola|commodities agr[ií]colas|safra|soja|milho|celulose|fertilizantes?|pecu[aá]ria|etanol/i,
};

const NEGATIVE_WORDS =
  /queda|caiu|caem|despenca|desaba|preju[ií]zo|corte de (previs[ãa]o|estimativa)|seca|estiagem|praga|geada|frustra(da|ção)?|abaixo do esperado|reduz(iu)? a previs[ãa]o|export[ao]ç[ãa]o (cai|recua)|pior que o esperado/i;

export interface SectorSignal {
  sector: string;
  count: number;
  sampleTitles: string[];
}

// Varre notícias B3 dos últimos `days` dias — conta quantas citam o setor E
// têm tom negativo pelo léxico acima.
export async function getNegativeSectorSignals(days = 7): Promise<SectorSignal[]> {
  const news = await getNews("b3", 200);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = news.filter((n) => new Date(n.publishedAt).getTime() >= since);

  const signals: SectorSignal[] = [];
  for (const [sector, pattern] of Object.entries(SECTOR_KEYWORDS)) {
    const matches = recent.filter((n) => pattern.test(n.title) && NEGATIVE_WORDS.test(n.title));
    if (matches.length > 0) {
      signals.push({ sector, count: matches.length, sampleTitles: matches.slice(0, 3).map((m) => m.title) });
    }
  }
  return signals;
}
