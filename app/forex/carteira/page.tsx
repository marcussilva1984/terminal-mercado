import { ForexCarteiraManager } from "@/components/ForexCarteiraManager";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ForexCarteiraPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <Link href="/forex" className="text-xs text-text-muted hover:text-text">← Forex (análise)</Link>
        </div>
        <h1 className="text-xl font-semibold text-text">Carteira Forex</h1>
        <p className="mt-1 text-sm text-text-muted">
          Registre o saldo de cada corretora quando quiser — o terminal calcula automaticamente o lucro entre
          lançamentos, descontando depósitos e retiradas.
        </p>
      </div>
      <ForexCarteiraManager />
    </div>
  );
}
