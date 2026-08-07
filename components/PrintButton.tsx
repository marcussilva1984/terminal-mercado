"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
    >
      Baixar PDF (imprimir)
    </button>
  );
}
