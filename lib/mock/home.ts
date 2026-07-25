import type { AlertStatus } from "@/lib/types";

// Alertas ainda são dados de exemplo — o sistema de alertas (Telegram) é uma fase futura.
export function getMockAlertStatus(): AlertStatus[] {
  return [
    { label: "Estrangeiro: 3 pregões seguidos de compra", triggeredAt: new Date().toISOString(), kind: "fluxo" },
    { label: "AZUL4: |z-score| ≥ 3 no dia", triggeredAt: new Date().toISOString(), kind: "zscore" },
  ];
}
