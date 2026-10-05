import { ForexIdeasPanel } from "@/components/ForexIdeasPanel";

export const metadata = { title: "Ideias de Trading Forex" };

export default function ForexIdeiasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ideias de Trading Forex</h1>
        <p className="mt-1 text-sm text-text-muted">
          Framework analítico baseado em carry, tendência e posicionamento COT. Swing trade — gráficos diários e semanais.
        </p>
      </div>
      <ForexIdeasPanel />
    </div>
  );
}
