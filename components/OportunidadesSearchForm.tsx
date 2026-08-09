const ASSET_CLASSES: { value: string; label: string }[] = [
  { value: "b3", label: "Ação B3" },
  { value: "fii", label: "FII" },
  { value: "stocks", label: "Stock (EUA)" },
  { value: "cripto", label: "Cripto" },
  { value: "forex", label: "Forex" },
];

// Form GET simples, sem JS — o próprio Next re-renderiza a página server-side
// com os query params, mesmo padrão já usado no toggle Resumido/Completo da
// Watchlist.
export function OportunidadesSearchForm({ symbol, assetClass }: { symbol?: string; assetClass?: string }) {
  return (
    <form action="/oportunidades" method="GET" className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Ativo</label>
        <input
          name="symbol"
          defaultValue={symbol}
          placeholder="PETR4, MXRF11, AAPL..."
          className="w-40 rounded border border-border bg-panel-alt px-2 py-1.5 text-sm text-text"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Classe</label>
        <select
          name="assetClass"
          defaultValue={assetClass ?? "b3"}
          className="rounded border border-border bg-panel-alt px-2 py-1.5 text-sm text-text"
        >
          {ASSET_CLASSES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
      >
        Buscar
      </button>
    </form>
  );
}
