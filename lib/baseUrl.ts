// URL absoluta pra fetches internos server-side (Server Components não podem
// usar caminho relativo). VERCEL_URL é injetada automaticamente em produção.
export function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
