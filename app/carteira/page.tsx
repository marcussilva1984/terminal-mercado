import { PortfolioManager } from "@/components/PortfolioManager";

export const dynamic = "force-dynamic";

export default function CarteiraPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Minha Carteira</h1>
        <p className="mt-1 text-sm text-text-muted">
          Cadastre suas posições (ações B3, FIIs, stocks e cripto) e alertas de preço via Telegram.
        </p>
      </div>
      <PortfolioManager />
    </div>
  );
}
