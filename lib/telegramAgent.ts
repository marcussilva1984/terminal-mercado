// Interpreta mensagens de texto livre do Telegram usando a API da Anthropic
// (tool use) e executa a ação correspondente no dashboard. Só processa
// mensagens vindas do TELEGRAM_CHAT_ID configurado — qualquer outro chat é
// ignorado, mesmo que descubra o bot.
import { getCurrentPrice } from "@/lib/priceLookup";
import { getEtfFlows } from "@/lib/sources/etfFlow";
import { formatCompact } from "@/lib/format";
import { addWatchlistItem, removeWatchlistItem, getWatchlist } from "@/lib/db/watchlistRepo";
import { addPriceAlert } from "@/lib/db/portfolioRepo";
import { formatPrice } from "@/lib/format";
import { getBaseUrl } from "@/lib/baseUrl";
import { getZScoreHighlights } from "@/lib/zscoreService";

const MODEL = "claude-haiku-4-5-20251001";

const TOOLS = [
  {
    name: "get_price",
    description: "Consulta o preço atual de um ativo (ação B3, stock EUA, cripto ou FII).",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Símbolo do ativo, ex: PETR4, AAPL, BTC, MXRF11" },
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii", "forex"] },
      },
      required: ["symbol", "assetClass"],
    },
  },
  {
    name: "get_etf_flow",
    description:
      "Consulta o fluxo líquido diário dos ETFs spot de cripto nos EUA (entrada/saída de dinheiro). Só existe ETF spot pra BTC, ETH e SOL — não existe pra outras criptos.",
    input_schema: {
      type: "object",
      properties: {
        asset: { type: "string", enum: ["btc", "eth", "sol"], description: "Opcional — se não especificado, retorna os 3." },
      },
    },
  },
  {
    name: "get_resumo",
    description: "Gera e retorna o resumo do dia (fluxo B3, altas, baixas, z-score).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "watchlist_add",
    description: "Adiciona um ativo na watchlist do usuário.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii", "forex"] },
        label: { type: "string", description: "Nome descritivo opcional" },
      },
      required: ["symbol", "assetClass"],
    },
  },
  {
    name: "watchlist_remove",
    description: "Remove um ativo da watchlist do usuário pelo símbolo.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii", "forex"] },
      },
      required: ["symbol", "assetClass"],
    },
  },
  {
    name: "get_zscore",
    description:
      "Consulta os destaques de z-score (desvio do padrão recente) da watchlist — ativos com movimento fora do comum. Opcionalmente filtra por classe.",
    input_schema: {
      type: "object",
      properties: {
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii", "forex"], description: "Opcional — se não especificado, retorna de todas as classes." },
      },
    },
  },
  {
    name: "price_alert_create",
    description: "Cria um alerta pra avisar quando um ativo bater um preço-alvo (acima ou abaixo).",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii", "forex"] },
        label: { type: "string" },
        direction: { type: "string", enum: ["above", "below"] },
        targetPrice: { type: "number" },
      },
      required: ["symbol", "assetClass", "direction", "targetPrice"],
    },
  },
] as const;

const SYSTEM_PROMPT = `Você é o assistente do Terminal de Mercado, um dashboard financeiro pessoal.
O usuário manda comandos em português, texto livre, pelo Telegram. Sua tarefa é entender o
que ele quer e chamar a ferramenta certa.

Regras pra inferir a classe do ativo (assetClass) quando o usuário não disser explicitamente:
- Ações brasileiras (B3) terminam em número: PETR4, VALE3, ITUB4
- FIIs (fundos imobiliários) sempre terminam em "11": MXRF11, HGLG11, KNRI11
- Stocks americanas são letras sem número: AAPL, TSLA, NVDA
- Criptomoedas: BTC, ETH, SOL, XRP etc.
- Pares de forex são duas moedas de 3 letras juntas (6 letras): EURUSD, GBPUSD, USDJPY, AUDNZD,
  dólar/euro/libra/iene etc. sempre que o usuário falar de câmbio/moeda.

O que você SABE fazer hoje (só isso — não invente outras capacidades): preço atual de um ativo,
fluxo de ETF spot de cripto (só BTC/ETH/SOL), resumo do dia, z-score da watchlist, adicionar/
remover ativo da watchlist, criar alerta de preço. Você NÃO tem acesso a: fórmulas de valuation
(Graham/Bazin), SMA200, Monte Carlo, correlação/beta, fatos relevantes, dividendos recebidos,
carteira — essas ferramentas ainda só existem no site. Se o usuário pedir uma dessas, diga
claramente que ainda não está disponível por aqui e que dá pra ver no dashboard, em vez de tentar
responder sem dado ou de forma vaga.

Se a mensagem não corresponder a nenhuma ação clara (ex: só um "oi", pergunta genérica sem
relação com o dashboard), NÃO chame nenhuma ferramenta — responda só com texto curto explicando
o que você pode fazer.

Sobre ETF de cripto: só existe ETF spot aprovado nos EUA pra BTC, ETH e SOL. Se o usuário
perguntar sobre ETF de outra moeda (ex: LINK, HYPE, XRP), NÃO chame get_etf_flow — responda em
texto explicando que essa moeda não tem ETF spot aprovado ainda.`;

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface TextBlock {
  type: "text";
  text: string;
}

async function callClaude(userMessage: string): Promise<{ toolCall: ToolUseBlock | null; text: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API respondeu ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const content: (ToolUseBlock | TextBlock)[] = json.content ?? [];
  const toolCall = (content.find((b) => b.type === "tool_use") as ToolUseBlock | undefined) ?? null;
  const textBlock = content.find((b) => b.type === "text") as TextBlock | undefined;

  return { toolCall, text: textBlock?.text ?? "" };
}

async function executeTool(toolCall: ToolUseBlock): Promise<string> {
  const input = toolCall.input as Record<string, string | number>;

  switch (toolCall.name) {
    case "get_price": {
      const symbol = String(input.symbol).toUpperCase();
      const assetClass = String(input.assetClass);
      const current = await getCurrentPrice(symbol, assetClass);
      if (!current) return `Não consegui achar preço pra ${symbol} (${assetClass}) agora.`;
      const changeSign = current.changePct >= 0 ? "+" : "";
      return `💰 <b>${symbol}</b>\n\nPreço: ${formatPrice(current.price, current.currency)}\nVariação: ${changeSign}${current.changePct.toFixed(2)}%`;
    }

    case "get_etf_flow": {
      const assetFilter = input.asset ? String(input.asset) : null;
      const flows = await getEtfFlows();
      const filtered = assetFilter ? flows.filter((f) => f.asset === assetFilter) : flows;
      if (filtered.length === 0) return "Sem dado de ETF disponível agora.";
      const lines = filtered.map((f) => {
        const sign = f.dailyNetInflowUsd >= 0 ? "+" : "-";
        return `<b>${f.asset.toUpperCase()}</b>\nFluxo do dia: ${sign} ${formatCompact(Math.abs(f.dailyNetInflowUsd), "US$")}\nPatrimônio total: ${formatCompact(f.totalNetAssetsUsd, "US$")}`;
      });
      return `📊 <b>Fluxo de ETFs Spot</b>\n\n${lines.join("\n\n")}`;
    }

    case "get_resumo": {
      const res = await fetch(`${getBaseUrl()}/api/resumo`, { cache: "no-store" });
      const json = await res.json();
      const html: string = json.telegramHtml ?? "Resumo indisponível no momento.";
      return html.length > 3500 ? `${html.slice(0, 3450)}\n\n[...continua no dashboard]` : html;
    }

    case "get_zscore": {
      const assetClass = input.assetClass ? String(input.assetClass) : undefined;
      const highlights = await getZScoreHighlights(assetClass as never).catch(() => null);
      if (!highlights || highlights.length === 0) return "Sem z-score disponível agora (histórico ainda insuficiente).";
      const top = highlights.slice(0, 8);
      const lines = top.map(
        (h) => `<b>${h.symbol}</b> (${h.assetClass}) — z=${h.zScore.toFixed(1)}, ${h.changePct >= 0 ? "+" : ""}${h.changePct.toFixed(2)}%`
      );
      return `📈 <b>Z-Score — Destaques</b>\n\n${lines.join("\n")}`;
    }

    case "watchlist_add": {
      const symbol = String(input.symbol).toUpperCase();
      const assetClass = String(input.assetClass);
      const label = input.label ? String(input.label) : symbol;
      await addWatchlistItem({ symbol, assetClass, label });
      return `✅ <b>${symbol}</b>\n\nAdicionado na watchlist (${assetClass}).`;
    }

    case "watchlist_remove": {
      const symbol = String(input.symbol).toUpperCase();
      const assetClass = String(input.assetClass);
      const items = await getWatchlist(assetClass);
      const match = items.find((i) => i.symbol.toUpperCase() === symbol);
      if (!match) return `Não achei ${symbol} na watchlist de ${assetClass}.`;
      await removeWatchlistItem(match.id);
      return `✅ <b>${symbol}</b>\n\nRemovido da watchlist.`;
    }

    case "price_alert_create": {
      const symbol = String(input.symbol).toUpperCase();
      const assetClass = String(input.assetClass);
      const label = input.label ? String(input.label) : symbol;
      const direction = String(input.direction) as "above" | "below";
      const targetPrice = Number(input.targetPrice);
      await addPriceAlert({ symbol, assetClass, label, direction, targetPrice });
      const verb = direction === "above" ? "subir acima de" : "cair abaixo de";
      return `🔔 <b>Alerta criado</b>\n\nAviso quando ${symbol} ${verb} ${targetPrice}.`;
    }

    default:
      return "Não entendi o comando.";
  }
}

export async function handleTelegramCommand(userMessage: string): Promise<string> {
  const { toolCall, text } = await callClaude(userMessage);
  if (!toolCall) {
    return text || "Não entendi — pode me pedir preço de um ativo, adicionar/remover da watchlist, criar alerta de preço ou o resumo do dia.";
  }
  try {
    return await executeTool(toolCall);
  } catch (err) {
    return `Erro ao executar: ${err instanceof Error ? err.message : "falha desconhecida"}`;
  }
}
