import { sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";

// Os crons aceitam dois segredos: o CRON_SECRET da Vercel (GitHub Actions e
// crons do vercel.json) e o "cron_secret" guardado no Vault do Supabase, que é
// o que o pg_cron envia — assim o agendador do banco funciona sem precisar
// copiar o segredo da Vercel pra dentro do banco.
let vaultSecret: { value: string | null; fetchedAt: number } | null = null;

async function getVaultCronSecret(): Promise<string | null> {
  if (!hasDatabase()) return null;
  if (vaultSecret && Date.now() - vaultSecret.fetchedAt < 10 * 60_000) return vaultSecret.value;
  try {
    const rows = await getDb().execute<{ decrypted_secret: string }>(
      sql`select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1`
    );
    vaultSecret = { value: rows[0]?.decrypted_secret ?? null, fetchedAt: Date.now() };
  } catch (e) {
    console.error("Não consegui ler cron_secret do Vault:", e);
    vaultSecret = { value: null, fetchedAt: Date.now() };
  }
  return vaultSecret.value;
}

export async function isCronAuthorized(request: Request): Promise<boolean> {
  const envSecret = process.env.CRON_SECRET;
  if (!envSecret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${envSecret}`) return true;
  const vault = await getVaultCronSecret();
  return Boolean(vault) && auth === `Bearer ${vault}`;
}
