import Parser from "rss-parser";
import iconv from "iconv-lite";
import type { NewsItem } from "@/lib/types";

export type NewsCategory = "b3" | "cripto" | "internacional" | "forex" | "fii" | "geral";

interface FeedConfig {
  source: string;
  url: string;
  category: NewsCategory;
}

// Feeds validados manualmente (status 200 + content-type RSS).
// Testados e FORA por bloqueio anti-bot (Cloudflare/403), mesmo com User-Agent de
// navegador: Livecoins, Financial Juice, TradersClub, Barron's, GuruFocus, Bitcoin
// Magazine, CoinGape. Reuters não tem mais RSS público. Bloomberg Línea, Washington
// Post, Estadão, R7 e Gazeta do Povo não têm feed público encontrado.
const FEEDS: FeedConfig[] = [
  // B3 / Brasil (mercado)
  { source: "InfoMoney", url: "https://www.infomoney.com.br/mercados/feed/", category: "b3" },
  { source: "Money Times", url: "https://www.moneytimes.com.br/feed/", category: "b3" },
  { source: "Exame Invest", url: "https://exame.com/invest/feed/", category: "b3" },
  { source: "Valor Econômico", url: "https://valor.globo.com/rss/valor", category: "b3" },

  // Cripto
  { source: "CoinTelegraph Brasil", url: "https://cointelegraph.com.br/rss", category: "cripto" },
  { source: "Portal do Bitcoin", url: "https://portaldobitcoin.uol.com.br/feed/", category: "cripto" },
  { source: "Cripto Fácil", url: "https://www.criptofacil.com/feed/", category: "cripto" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss", category: "cripto" },
  { source: "CryptoSlate", url: "https://cryptoslate.com/feed/", category: "cripto" },
  { source: "Decrypt", url: "https://decrypt.co/feed", category: "cripto" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml", category: "cripto" },
  { source: "AMBCrypto", url: "https://ambcrypto.com/feed/", category: "cripto" },
  { source: "Bitcoinist", url: "https://bitcoinist.com/feed/", category: "cripto" },
  { source: "BeInCrypto", url: "https://beincrypto.com/feed/", category: "cripto" },
  { source: "Daily Hodl", url: "https://dailyhodl.com/feed/", category: "cripto" },
  { source: "The Defiant", url: "https://thedefiant.io/api/feed", category: "cripto" },

  // Internacional (mercado/finanças — usado na aba Stocks)
  { source: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "internacional" },
  { source: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", category: "internacional" },
  { source: "Investing.com", url: "https://www.investing.com/rss/news.rss", category: "internacional" },
  { source: "ZeroHedge", url: "https://cms.zerohedge.com/fullrss2.xml", category: "internacional" },
  { source: "WSJ Markets", url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", category: "internacional" },
  { source: "Bloomberg", url: "https://www.bloomberg.com/feeds/markets/news.rss", category: "internacional" },
  { source: "The Economist", url: "https://www.economist.com/finance-and-economics/rss.xml", category: "internacional" },
  { source: "Seeking Alpha", url: "https://seekingalpha.com/feed.xml", category: "internacional" },
  { source: "DigiTimes", url: "https://www.digitimes.com/rss/daily.xml", category: "internacional" },
  { source: "Nikkei Asia", url: "https://asia.nikkei.com/rss/feed/nar", category: "internacional" },
  { source: "ING Think", url: "https://think.ing.com/rss/", category: "internacional" },
  { source: "ECB (Banco Central Europeu)", url: "https://www.ecb.europa.eu/rss/press.html", category: "internacional" },
  { source: "Federal Reserve (Fed)", url: "https://www.federalreserve.gov/feeds/press_all.xml", category: "internacional" },
  { source: "Bank of England (BoE)", url: "https://www.bankofengland.co.uk/rss/news", category: "internacional" },
  { source: "Bank of Japan (BoJ)", url: "https://www.boj.or.jp/en/rss/whatsnew.xml", category: "internacional" },

  // Forex
  { source: "FXStreet", url: "https://www.fxstreet.com/rss/news", category: "forex" },
  { source: "InvestingLive (ex-ForexLive)", url: "https://investinglive.com/feed/", category: "forex" },
  { source: "MarketPulse (OANDA)", url: "https://www.marketpulse.com/feed/", category: "forex" },

  // FII
  { source: "InfoMoney FIIs", url: "https://www.infomoney.com.br/tudo-sobre/fundos-imobiliarios/feed/", category: "fii" },

  // Geral (mundo — só aparece na aba Notícias, não polui as abas de mercado)
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "geral" },
  { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "geral" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss", category: "geral" },
  { source: "CNN", url: "http://rss.cnn.com/rss/edition_world.rss", category: "geral" },
  { source: "France 24", url: "https://www.france24.com/en/rss", category: "geral" },
  { source: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-all", category: "geral" },
  { source: "CBC", url: "https://www.cbc.ca/webfeed/rss/rss-world", category: "geral" },
  { source: "AP News", url: "https://feedx.net/rss/ap.xml", category: "geral" },
  { source: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "geral" },
  { source: "WSJ Mundo", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", category: "geral" },
  { source: "Financial Times", url: "https://www.ft.com/rss/home/international", category: "geral" },
  { source: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed/", category: "geral" },
  { source: "G1", url: "https://g1.globo.com/rss/g1/", category: "geral" },
  { source: "UOL", url: "https://rss.uol.com.br/feed/noticias.xml", category: "geral" },
  { source: "CNN Brasil", url: "https://admin.cnnbrasil.com.br/feed/", category: "geral" },
  { source: "Folha de S.Paulo", url: "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml", category: "geral" },
  { source: "Poder360", url: "https://www.poder360.com.br/feed/", category: "geral" },
  { source: "Jovem Pan", url: "https://jovempan.com.br/feed/", category: "geral" },
  { source: "Veja", url: "https://veja.abril.com.br/feed/", category: "geral" },
];

const parser = new Parser({ timeout: 8000 });

// Ruído de baixo valor (arquivamentos SEC de rotina, alertas de insider trading em
// massa) que algumas fontes (Investing.com) publicam em volume alto e afogam o resto.
const LOW_SIGNAL_TITLE = /^Form [A-Z0-9-]|insider trading|sells? \$[\d,.]+/i;

// Feeds "geral" (G1, UOL, Folha etc.) misturam tudo do site inteiro numa RSS
// só — sem seção separada de economia/política. Filtra fofoca/celebridades/
// entretenimento/esporte-resultado, que não tem relação com o propósito do
// dashboard (mercado financeiro, economia, geopolítica, tecnologia, política).
const GOSSIP_PATTERN =
  /novela|bbb\b|big brother|celebridade|famos[ao]s?|ator |atriz |cantor[a]?\b|namoro|affair|term(ina|inou) o? ?namoro|traição|climão|polêmica de|reality show|horóscopo|receita de|beleza e|celebrit(y|ies)|hollywood|red carpet|tapete vermelho|fofoca|paparazzi|separa(ç|c)ão de|ex-namorad[ao]|gravide[z]|casamento de|affair de|dieta d[eo]|maquiagem|moda e beleza|futebol.*(gol|placar|escala(ç|c)ão|jogo de hoje)|campeonato.*futebol/i;

const MAX_ITEMS_PER_FEED = 8;

export interface NewsItemWithCategory extends NewsItem {
  category: NewsCategory;
}

// Alguns feeds (Folha, UOL) declaram encoding não-UTF8 (ISO-8859-1) no XML.
// `fetch` sempre decodifica como texto em UTF-8, corrompendo acentos — por isso
// buscamos os bytes crus e decodificamos manualmente conforme o encoding declarado.
async function fetchFeedXml(url: string): Promise<string> {
  // Sem isso, cada navegação buscava as ~29 fontes RSS do zero (sem cache
  // nenhum) — de longe o maior contribuinte pro delay ao trocar de aba.
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
    next: { revalidate: 5 * 60 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Feed respondeu ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const preview = buffer.subarray(0, 200).toString("ascii");
  const match = preview.match(/encoding=["']([\w-]+)["']/i);
  const encoding = match?.[1]?.toLowerCase();

  if (encoding && encoding !== "utf-8" && encoding !== "utf8" && iconv.encodingExists(encoding)) {
    return iconv.decode(buffer, encoding);
  }
  return buffer.toString("utf-8");
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItemWithCategory[]> {
  try {
    const xml = await fetchFeedXml(feed.url);
    const parsed = await parser.parseString(xml);
    return (parsed.items ?? [])
      .map((item) => ({
        title: item.title ?? "(sem título)",
        source: feed.source,
        url: item.link ?? feed.url,
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        category: feed.category,
      }))
      .filter((item) => !LOW_SIGNAL_TITLE.test(item.title) && !GOSSIP_PATTERN.test(item.title))
      .slice(0, MAX_ITEMS_PER_FEED);
  } catch {
    // Fonte indisponível: não derruba o agregado, só fica de fora desta rodada.
    return [];
  }
}

export async function getNews(category?: NewsCategory, limit = 20): Promise<NewsItem[]> {
  const feeds = category ? FEEDS.filter((f) => f.category === category) : FEEDS;
  const results = await Promise.all(feeds.map(fetchFeed));
  return results
    .flat()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

// Todas as categorias, sem filtro, com a categoria de cada item — usado na aba
// "Notícias" (agregador geral com filtro) e no digest do Telegram.
export async function getAllNewsWithCategory(limit = 60): Promise<NewsItemWithCategory[]> {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  return results
    .flat()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
