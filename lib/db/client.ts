import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let cached: ReturnType<typeof drizzle> | null = null;

// Lazy singleton: só conecta quando DATABASE_URL existe. Fora do MVP (Fase 4/5 sem
// Supabase configurado) o restante do app continua funcionando sem banco.
export function getDb() {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL não configurada");
  }
  if (!cached) {
    // prepare: false é obrigatório com o Transaction pooler do Supabase (PgBouncer em
    // modo transaction não suporta prepared statements — sem isso, inserts em lote falham).
    const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    cached = drizzle(client, { schema });
  }
  return cached;
}
