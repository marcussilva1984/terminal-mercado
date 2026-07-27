"use client";

import { useState } from "react";

export function CopyResumoButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/api/resumo");
      const json = await res.json();
      await navigator.clipboard.writeText(json.markdown);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      className="rounded border border-gold/40 bg-panel-alt px-3 py-1.5 text-sm text-gold-bright hover:bg-panel"
    >
      {status === "loading" && "Gerando..."}
      {status === "done" && "Copiado!"}
      {status === "error" && "Falhou, tente de novo"}
      {status === "idle" && "Copiar Resumo do Dia"}
    </button>
  );
}
