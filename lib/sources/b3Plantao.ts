import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";

// Plantão de Notícias da B3 (agência 18 = comunicados das companhias): sai em
// minutos, com horário ao segundo — o CSV da CVM só é republicado uma vez por
// semana, por isso os alertas chegavam em lote no domingo.
const BASE = "https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias";

export interface B3Comunicado {
  id: number;
  headline: string;
  company: string;
  dateTime: string; // "YYYY-MM-DD HH:mm:ss", horário de Brasília
  url: string;
}

function brDate(offsetDays: number): string {
  const d = new Date(Date.now() - 3 * 3600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function getB3FatosRelevantes(): Promise<B3Comunicado[]> {
  const url = `${BASE}/ListarTitulosNoticias?agencia=18&palavra=&dataInicial=${brDate(-1)}&dataFinal=${brDate(0)}`;
  const res = await fetch(url, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Plantão de Notícias da B3 respondeu ${res.status}`);
  const items: { NwsMsg: { id: number; headline: string; dateTime: string } }[] = await res.json();

  return items
    .map((i) => i.NwsMsg)
    .filter((n) => /fato relevante/i.test(n.headline))
    .map((n) => ({
      id: n.id,
      headline: n.headline.trim(),
      company: n.headline.split(/\s+-\s+Fato Relevante/i)[0].trim(),
      dateTime: n.dateTime,
      url: `${BASE}/Detail?idNoticia=${n.id}&agencia=18&dataNoticia=${encodeURIComponent(n.dateTime)}`,
    }))
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
}
