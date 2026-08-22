// User-agent genérico como "Mozilla/5.0" sozinho passou a ser bloqueado pelo
// WAF do dadosdemercado.com.br (403 "Request blocked") — confirmado que uma
// string de navegador real resolve (testado direto, sem esse header dá 403,
// com ele dá 200). Centralizado aqui pra todo scraper usar a mesma string
// realista em vez do fragmento genérico que virou fingerprint de bot.
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
