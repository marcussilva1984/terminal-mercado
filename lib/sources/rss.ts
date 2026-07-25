import Parser from "rss-parser";
import type { NewsItem } from "@/lib/types";

export type NewsCategory = "b3" | "cripto" | "internacional" | "forex" | "fii";

interface FeedConfig {
  source: string;
  url: string;
  category: NewsCategory;
}

// Feeds validados manualmente (status 200 + content-type RSS).
// Testados e FORA por bloqueio anti-bot (Cloudflare/403), mesmo com User-Agent de
// navegador: Livecoins, Financial Juice, TradersClub, Barron's, GuruFocus.
// Reuters não tem mais RSS público. Bloomberg Línea não tem feed encontrado.
const FEEDS: FeedConfig[] = [
  { source: "InfoMoney", url: "https://www.infomoney.com.br/mercados/feed/", category: "b3" },
  { source: "Money Times", url: "https://www.moneytimes.com.br/feed/", category: "b3" },
  { source: "Exame Invest", url: "https://exame.com/invest/feed/", category: "b3" },
  { source: "CoinTelegraph Brasil", url: "https://cointelegraph.com.br/rss", category: "cripto" },
  { source: "Portal do Bitcoin", url: "https://portaldobitcoin.uol.com.br/feed/", category: "cripto" },
  { source: "Cripto Fácil", url: "https://www.criptofacil.com/feed/", category: "cripto" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss", category: "cripto" },
  { source: "CryptoSlate", url: "https://cryptoslate.com/feed/", category: "cripto" },
  { source: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "internacional" },
  { source: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/", category: "internacional" },
  { source: "Investing.com", url: "https://www.investing.com/rss/news.rss", category: "internacional" },
  { source: "ZeroHedge", url: "https://cms.zerohedge.com/fullrss2.xml", category: "internacional" },
  { source: "WSJ Markets", url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", category: "internacional" },
  { source: "Bloomberg", url: "https://www.bloomberg.com/feeds/markets/news.rss", category: "internacional" },
  { source: "The Economist", url: "https://www.economist.com/finance-and-economics/rss.xml", category: "internacional" },
  { source: "Seeking Alpha", url: "https://seekingalpha.com/feed.xml", category: "internacional" },
  { source: "DigiTimes", url: "https://www.digitimes.com/rss/daily.xml", category: "internacional" },
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "internacional" },
  { source: "FXStreet", url: "https://www.fxstreet.com/rss/news", category: "forex" },
  { source: "InfoMoney FIIs", url: "https://www.infomoney.com.br/tudo-sobre/fundos-imobiliarios/feed/", category: "fii" },
];

const parser = new Parser({ timeout: 8000 });

// Ruído de baixo valor (arquivamentos SEC de rotina, alertas de insider trading em
// massa) que algumas fontes (Investing.com) publicam em volume alto e afogam o resto.
const LOW_SIGNAL_TITLE = /^Form [A-Z0-9-]|insider trading|sells? \$[\d,.]+/i;

const MAX_ITEMS_PER_FEED = 8;

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items ?? [])
      .map((item) => ({
        title: item.title ?? "(sem título)",
        source: feed.source,
        url: item.link ?? feed.url,
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
      }))
      .filter((item) => !LOW_SIGNAL_TITLE.test(item.title))
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
