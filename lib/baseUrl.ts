// URL absoluta pra fetches internos server-side (Server Components não podem
// usar caminho relativo).
//
// Em produção usa o domínio customizado fixo, NÃO o VERCEL_URL (hash de
// deployment tipo terminal-mercado-xyz123.vercel.app) — self-fetches para
// esse domínio de deployment específico se mostraram pouco confiáveis
// (rotas edge retornando vazio mesmo funcionando normalmente quando
// acessadas pelo domínio de produção). Em preview/dev, cai pro VERCEL_URL.
const PRODUCTION_URL = "https://terminal-mercado.vercel.app";

export function getBaseUrl(): string {
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
