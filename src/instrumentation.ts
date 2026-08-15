export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateConfig, ConfigError } = await import("@/lib/config");
  const config = validateConfig();
  if (!config.ok) {
    // `next build` sets NODE_ENV=production but runs without a DB; skip there.
    // At runtime, an invalid config must crash the container so `docker compose
    // up` fails fast with a useful message instead of serving a broken app.
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new ConfigError(`Invalid configuration. Missing or invalid: ${config.errors.join(", ")}`);
    }
    return; // no DB configured — build/dev without a DB must still work
  }
  const { runMigrations } = await import("@/lib/db/migrate");
  await runMigrations();
  const { seedAdminIfNeeded } = await import("@/lib/repo/users");
  const { getDb } = await import("@/lib/db");
  await seedAdminIfNeeded(getDb());
}
