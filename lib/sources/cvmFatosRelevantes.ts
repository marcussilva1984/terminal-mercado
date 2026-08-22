import { BROWSER_USER_AGENT } from "@/lib/sources/httpHeaders";
import { unzipSync, strFromU8 } from "fflate";

// Fatos Relevantes via dados abertos oficiais da CVM (gratuito, sem chave) —
// CSV anual com todos os documentos "IPE" (Informações Periódicas e
// Eventuais) publicados pelas companhias abertas, filtrado pra categoria
// "Fato Relevante".
const BASE_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS";

export interface FatoRelevante {
  companyName: string;
  date: string; // ISO
  subject: string;
  documentUrl: string;
}

function parseBRDate(raw: string): string {
  // CSV já vem em yyyy-mm-dd
  return raw.trim();
}

async function fetchYearCsv(year: number): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/ipe_cia_aberta_${year}.zip`, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    next: { revalidate: 6 * 60 * 60 },
  });
  if (!res.ok) return null;

  const buffer = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buffer);
  const filename = Object.keys(files).find((f) => f.endsWith(".csv"));
  if (!filename) return null;

  // O CSV vem em ISO-8859-1 (acentos quebram se decodificar como UTF-8) —
  // fflate's strFromU8 com latin1=true decodifica corretamente.
  return strFromU8(files[filename], true);
}

export async function getFatosRelevantes(limit = 30): Promise<FatoRelevante[]> {
  const now = new Date();
  const csv = await fetchYearCsv(now.getUTCFullYear());
  if (!csv) throw new Error("CSV de fatos relevantes indisponível na CVM");

  const lines = csv.split("\n").filter((l) => l.trim().length > 0);
  const rows = lines.slice(1).map((l) => l.split(";"));

  const todayISO = now.toISOString().slice(0, 10);

  const items: FatoRelevante[] = rows
    .filter((r) => r[4]?.trim() === "Fato Relevante")
    .map((r) => ({
      companyName: r[1]?.trim() ?? "",
      date: parseBRDate(r[3] ?? ""),
      subject: r[7]?.trim() || "Fato Relevante",
      documentUrl: r[12]?.trim() ?? "",
    }))
    // A própria CVM já teve erro de digitação de ano no CSV (ex.: "3026" em
    // vez de "2026") — descarta datas futuras implausíveis pra não deixar
    // isso subir ao topo da lista por ordenação.
    .filter((item) => item.companyName && item.date && item.date <= todayISO);

  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
