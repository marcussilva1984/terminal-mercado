# Terminal de Mercado

Dashboard estilo "terminal de mercado" — B3, Cripto, Stocks (EUA), Forex e FII — construído em
Next.js (App Router) + TypeScript + Tailwind CSS. Delay de minutos a 1-2 dias úteis é aceitável;
não usa feed tick-a-tick licenciado de bolsa.

## Status atual

Todas as 6 abas estão implementadas com dados reais (delay curto, sem chave paga):

- **Home** — resumo do dia: preços, fluxo B3, top altas/baixas, z-score, notícias.
- **Ações (B3)** — fluxo de investidores + semáforo, rankings de altas/baixas/volume
  (liquidez filtrada), z-score da watchlist. "Alugadas" indisponível (TradersClub bloqueia bots).
- **Cripto** — altas/baixas/volume/market cap (CoinGecko), z-score.
- **Stocks (EUA)** — índices, watchlist, rankings de altas/baixas/volume (Yahoo Finance).
- **Forex** — pares G8 + BRL, currency strength meter, DXY, curva de juros dos EUA.
- **FII** — IFIX, altas/baixas de cota, ranking de dividend yield.

Z-score (B3 + Cripto) precisa de `DATABASE_URL` configurada — ver seção abaixo; sem isso o painel
mostra uma mensagem pedindo para configurar o banco, o resto do app funciona normalmente.

Fora do escopo por enquanto: Alertas via Telegram, Exportação de resumo em markdown, curva de
juros do Brasil (DI — scraping mais trabalhoso), edição de watchlist pela UI.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Sem `DATABASE_URL`, tudo funciona exceto os
painéis de Z-Score (mostram uma mensagem pedindo para configurar o banco).

## Habilitando o Z-Score (Fase 5)

1. Crie um projeto grátis em [supabase.com](https://supabase.com) e copie a connection string
   (modo "Session pooler" ou direto, ambos funcionam com o driver `postgres`).
2. Copie `.env.example` para `.env.local` e preencha `DATABASE_URL`.
3. Rode as migrations: `npm run db:push` (ou `npm run db:migrate` depois de `npm run db:generate`
   se preferir versionar as migrations).
4. Popule o histórico inicial: `npm run backfill` (busca ~3 meses de histórico via brapi.dev e
   CoinGecko e grava em `price_series`).
5. `npm run dev` — os painéis de Z-Score na Home, em Ações e em Cripto passam a mostrar dados
   reais. Amostras com menos de 10 pregões de histórico ainda contam como "não confiável"
   internamente (campo `reliable` em `lib/zscore.ts`), mesmo já aparecendo na lista.

Em produção, o cron `/api/cron/price-snapshot` (ver `vercel.json`) mantém `price_series`
atualizada diariamente.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha conforme a fase que estiver em uso:

- `DATABASE_URL` — connection string do Postgres (Supabase). Necessário para os painéis de
  Z-Score (Fase 5) e para a persistência opcional do fluxo B3 via cron.
- `BRAPI_TOKEN` — token grátis de [brapi.dev](https://brapi.dev). Sem ele, a watchlist B3 do
  z-score fica limitada aos 4 tickers livres (PETR4/VALE3/MGLU3/ITUB4), que já são os usados por
  padrão em `lib/watchlist.ts`.
- `CRON_SECRET` — segredo usado para proteger as rotas `/api/cron/*` chamadas pelo Vercel Cron.
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — usados na fase de Alertas (fora do MVP). Crie o bot
  com [@BotFather](https://t.me/BotFather) quando chegarmos nessa fase.

## Deploy

Projeto pensado para deploy na Vercel (`vercel deploy`), com Postgres no Supabase e cron jobs via
`vercel.json`. O deploy em si e o provisionamento de Supabase/Vercel ficam por conta do usuário.

## Notas sobre fontes de dados

- Cotações têm delay (~15 min nas fontes grátis) — sempre exibidas com timestamp, nunca como
  "tempo real oficial".
- **Preços/índices/forex/stocks**: Yahoo Finance (API não-oficial `query1.finance.yahoo.com`),
  sem chave. Cobre índices, ações de qualquer bolsa (`.SA` para B3), moedas, commodities e os
  screeners `day_gainers`/`day_losers`/`most_actives` do mercado dos EUA inteiro.
- **Cripto**: CoinGecko (sem chave).
- **Rankings B3 e FII**: brapi.dev `/quote/list` (sem chave), ~780 ações e ~450 fundos, filtrados
  por liquidez mínima para tirar frações/cotas paradas do topo do ranking.
- **Fluxo B3**: [dadosdemercado.com.br](https://www.dadosdemercado.com.br/fluxo), um agregador
  público do boletim oficial da B3 (não é o endpoint oficial da B3, que só abre esse detalhamento
  via DataWise+, pago). O segmento "Outros" no semáforo é um proxy que mistura pessoa jurídica,
  clubes de investimento e demais categorias — a fonte gratuita não separa isso.
- **Dividend yield de FII**: investidor10.com.br (scrape de tabela server-renderizada).
- Rankings de "vendidas"/"mais vendidos" são proxies (queda de preço, % alugado, volume) — não
  existe fluxo oficial por papel/tipo de investidor de graça (isso é B3 DataWise+, pago).
  TradersClub (alugadas) bloqueia requisições automatizadas via Cloudflare — não tentamos contornar.
- Z-score usa a variação diária do fechamento vs. média/desvio-padrão dos últimos 30 pregões
  anteriores, calculado a partir do histórico salvo em `price_series` (populado pelo backfill e
  mantido pelo cron `price-snapshot`).
- Notícias agregam 12 feeds RSS (B3, cripto, EUA/internacional, forex, FII); cada fonte contribui
  no máximo 8 itens por rodada para nenhuma dominar o feed agregado, e títulos de baixo valor
  (arquivamentos SEC de rotina) são filtrados.

<!-- deploy automático via GitHub conectado -->
