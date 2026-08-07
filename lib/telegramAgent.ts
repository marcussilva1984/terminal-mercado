// Interpreta mensagens de texto livre do Telegram usando a API da Anthropic
// (tool use) e executa a ação correspondente no dashboard. Só processa
// mensagens vindas do TELEGRAM_CHAT_ID configurado — qualquer outro chat é
// ignorado, mesmo que descubra o bot.
import { getCurrentPrice } from "@/lib/priceLookup";
import { addWatchlistItem, removeWatchlistItem, getWatchlist } from "@/lib/db/watchlistRepo";
import { addPriceAlert } from "@/lib/db/portfolioRepo";
import { formatPrice } from "@/lib/format";
import { getBaseUrl } from "@/lib/baseUrl";

const MODEL = "claude-haiku-4-5-20251001";

const TOOLS = [
  {
    name: "get_price",
    description: "Consulta o preço atual de um ativo (ação B3, stock EUA, cripto ou FII).",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Símbolo do ativo, ex: PETR4, AAPL, BTC, MXRF11" },
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii"] },
      },
      required: ["symbol", "assetClass"],
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
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii"] },
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
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii"] },
      },
      required: ["symbol", "assetClass"],
    },
  },
  {
    name: "price_alert_create",
    description: "Cria um alerta pra avisar quando um ativo bater um preço-alvo (acima ou abaixo).",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        assetClass: { type: "string", enum: ["b3", "stocks", "cripto", "fii"] },
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
- Ações brasileiras (B3) terminam em número: PETR4, VALE3, MXRF11 (FII), ITUB4
- FIIs (fundos imobiliários) sempre terminam em "11": MXRF11, HGLG11, KNRI11
- Stocks americanas são letras sem número: AAPL, TSLA, NVDA
- Criptomoedas: BTC, ETH, SOL, XRP etc.

Se a mensagem não corresponder a nenhuma ação clara (ex: só um "oi", pergunta genérica sem
relação com o dashboard), NÃO chame nenhuma ferramenta — responda só com texto curto explicando
o que você pode fazer.`;

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
      return `${symbol}: ${formatPrice(current.price, current.currency)} (${current.changePct >= 0 ? "+" : ""}${current.changePct.toFixed(2)}%)`;
    }

    case "get_resumo": {
      const res = await fetch(`${getBaseUrl()}/api/resumo`, { cache: "no-store" });
      const json = await res.json();
      const markdown: string = json.markdown ?? "Resumo indisponível no momento.";
      return markdown.length > 3500 ? `${markdown.slice(0, 3450)}\n\n[...continua no dashboard]` : markdown;
    }

    case "watchlist_add": {
      const symbol = String(input.symbol).toUpperCase();
      const assetClass = String(input.assetClass);
      const label = input.label ? String(input.label) : symbol;
      await addWatchlistItem({ symbol, assetClass, label });
      return `✅ ${symbol} adicionado na watchlist (${assetClass}).`;
    }

    case "watchlist_remove": {
      const symbol = String(input.symbol).toUpperCase();
      const assetClass = String(input.assetClass);
      const items = await getWatchlist(assetClass);
      const match = items.find((i) => i.symbol.toUpperCase() === symbol);
      if (!match) return `Não achei ${symbol} na watchlist de ${assetClass}.`;
      await removeWatchlistItem(match.id);
      return `✅ ${symbol} removido da watchlist.`;
    }

    case "price_alert_create": {
      const symbol = String(input.symbol).toUpperCase();
      const assetClass = String(input.assetClass);
      const label = input.label ? String(input.label) : symbol;
      const direction = String(input.direction) as "above" | "below";
      const targetPrice = Number(input.targetPrice);
      await addPriceAlert({ symbol, assetClass, label, direction, targetPrice });
      const verb = direction === "above" ? "subir acima de" : "cair abaixo de";
      return `✅ Alerta criado: aviso quando ${symbol} ${verb} ${targetPrice}.`;
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
