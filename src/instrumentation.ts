export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateConfig } = await import("@/lib/config");
  if (!validateConfig().ok) return; // no DB configured — build/dev without a DB must still work
  const { runMigrations } = await import("@/lib/db/migrate");
  await runMigrations();
}
