import { unstable_cache } from "next/cache";
import { unzipSync, strFromU8 } from "fflate";

// Fluxo de caixa oficial da CVM (Dados Abertos) — usado pro DCF. Diferente do
// Fundamentus (que não tem DFC nenhum), aqui é o demonstrativo financeiro de
// verdade que a empresa envia à CVM todo ano (DFP = Demonstrações Financeiras
// Padronizadas, ciclo anual).
const CVM_BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA";

async function fetchZipEntry(url: string, entryName: string): Promise<string> {
  const res = await fetch(url, { next: { revalidate: 7 * 24 * 60 * 60 }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`CVM respondeu ${res.status} em ${url}`);
  const buffer = new Uint8Array(await res.arrayBuffer());

  // Mesma lib já usada em cvmFatosRelevantes.ts pros outros ZIPs da CVM —
  // CSVs vêm em ISO-8859-1, strFromU8 com latin1=true decodifica certo.
  const files = unzipSync(buffer);
  const data = files[entryName];
  if (!data) throw new Error(`Entry ${entryName} não encontrado no ZIP de ${url}`);
  return strFromU8(data, true);
}

function parseCsvLine(line: string): string[] {
  return line.split(";");
}

// ticker (ex.: PETR4) -> CNPJ da companhia, via cadastro oficial da CVM
// (fca_cia_aberta_valor_mobiliario, que lista o "Código de Negociação" B3 de
// cada classe de ação por empresa).
async function computeTickerToCnpjMap(): Promise<Record<string, string>> {
  const year = new Date().getUTCFullYear();
  const url = `${CVM_BASE}/DOC/FCA/DADOS/fca_cia_aberta_${year}.zip`;
  const csv = await fetchZipEntry(url, `fca_cia_aberta_valor_mobiliario_${year}.csv`);

  const lines = csv.split("\n").filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]);
  const cnpjIdx = header.indexOf("CNPJ_Companhia");
  const codigoIdx = header.indexOf("Codigo_Negociacao");

  const map: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const codigo = cells[codigoIdx]?.trim();
    const cnpj = cells[cnpjIdx]?.trim();
    if (codigo && cnpj) map[codigo.toUpperCase()] = cnpj;
  }
  return map;
}

export const getTickerToCnpjMap = unstable_cache(computeTickerToCnpjMap, ["cvm-ticker-cnpj"], {
  revalidate: 7 * 24 * 60 * 60,
});

export interface AnnualCashFlow {
  cnpj: string;
  fiscalYear: string; // ISO da data-fim (ex.: "2025-12-31")
  operatingCashFlow: number; // em milhares de R$
  investingCashFlow: number; // em milhares de R$, normalmente negativo
  freeCashFlow: number; // operatingCashFlow + investingCashFlow (proxy de FCF)
}

// Índice CNPJ -> fluxo de caixa do último ano fiscal completo, a partir do
// DFP (anual) mais recente disponível. Tenta o ano corrente primeiro (nem
// toda empresa já entregou o DFP do ano corrente cedo no ano) e cai pro
// anterior se o arquivo ainda não existir ou não tiver a empresa.
async function computeAnnualCashFlowIndex(): Promise<Record<string, AnnualCashFlow>> {
  const now = new Date();
  const candidateYears = [now.getUTCFullYear(), now.getUTCFullYear() - 1];

  const index: Record<string, AnnualCashFlow> = {};

  for (const year of candidateYears) {
    let csv: string;
    try {
      const url = `${CVM_BASE}/DOC/DFP/DADOS/dfp_cia_aberta_${year}.zip`;
      csv = await fetchZipEntry(url, `dfp_cia_aberta_DFC_MI_con_${year}.csv`);
    } catch {
      continue; // arquivo desse ano ainda não existe ou não tem DFC consolidado
    }

    const lines = csv.split("\n").filter((l) => l.trim().length > 0);
    const header = parseCsvLine(lines[0]);
    const cnpjIdx = header.indexOf("CNPJ_CIA");
    const ordemIdx = header.indexOf("ORDEM_EXERC");
    const dtFimIdx = header.indexOf("DT_FIM_EXERC");
    const contaIdx = header.indexOf("CD_CONTA");
    const valorIdx = header.indexOf("VL_CONTA");

    const rowsByCnpj = new Map<string, { cfo?: number; investing?: number; dtFim?: string }>();

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      if (cells[ordemIdx] !== "ÚLTIMO") continue; // só o período mais recente do arquivo, não o comparativo
      const conta = cells[contaIdx];
      if (conta !== "6.01" && conta !== "6.02") continue;

      const cnpj = cells[cnpjIdx];
      const value = parseFloat(cells[valorIdx]);
      if (!cnpj || Number.isNaN(value)) continue;

      const entry = rowsByCnpj.get(cnpj) ?? {};
      if (conta === "6.01") entry.cfo = value;
      if (conta === "6.02") entry.investing = value;
      entry.dtFim = cells[dtFimIdx];
      rowsByCnpj.set(cnpj, entry);
    }

    for (const [cnpj, entry] of rowsByCnpj) {
      // Já temos essa empresa de um ano mais recente (candidateYears é
      // decrescente) — não sobrescreve com dado mais antigo.
      if (index[cnpj]) continue;
      if (entry.cfo === undefined || entry.investing === undefined || !entry.dtFim) continue;
      index[cnpj] = {
        cnpj,
        fiscalYear: entry.dtFim,
        operatingCashFlow: entry.cfo,
        investingCashFlow: entry.investing,
        freeCashFlow: entry.cfo + entry.investing,
      };
    }
  }

  return index;
}

export const getAnnualCashFlowIndex = unstable_cache(computeAnnualCashFlowIndex, ["cvm-annual-cashflow"], {
  revalidate: 24 * 60 * 60,
});

export async function getAnnualCashFlow(ticker: string): Promise<AnnualCashFlow | null> {
  const [tickerMap, cfIndex] = await Promise.all([getTickerToCnpjMap(), getAnnualCashFlowIndex()]);
  const cnpj = tickerMap[ticker.toUpperCase()];
  if (!cnpj) return null;
  return cfIndex[cnpj] ?? null;
}
