export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPrice(value: number, currency?: string): string {
  if (currency === "USD") return `US$ ${formatNumber(value)}`;
  if (currency === "BRL") return `R$ ${formatNumber(value)}`;
  return formatNumber(value, value < 10 ? 4 : 2);
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

export function formatBRLCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "+";
  if (abs >= 1_000_000_000) return `${sign} R$ ${formatNumber(abs / 1_000_000_000)} bi`;
  if (abs >= 1_000_000) return `${sign} R$ ${formatNumber(abs / 1_000_000)} mi`;
  return `${sign} R$ ${formatNumber(abs)}`;
}

export function formatUSDCompact(value: number): string {
  return formatCompact(value, "US$");
}

export function formatCompact(value: number, currencySymbol: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${currencySymbol} ${formatNumber(abs / 1_000_000_000)} bi`;
  if (abs >= 1_000_000) return `${currencySymbol} ${formatNumber(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${currencySymbol} ${formatNumber(abs / 1_000)} mil`;
  return `${currencySymbol} ${formatNumber(abs)}`;
}

// timeZone fixo é obrigatório aqui: sem isso, o mesmo horário ISO aparece
// diferente dependendo de onde é formatado — painéis renderizados no
// servidor (Vercel, UTC) mostravam um horário, e os mesmos painéis quando
// envolvidos por um componente client (formatados no navegador do usuário,
// America/Sao_Paulo) mostravam outro, um "Atualizado" 3h diferente do outro
// na mesma tela.
const BRASILIA_TZ = "America/Sao_Paulo";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BRASILIA_TZ,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BRASILIA_TZ,
  });
}

export function changeColorClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-text-muted";
}
