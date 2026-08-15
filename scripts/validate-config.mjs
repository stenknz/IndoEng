#!/usr/bin/env node
// Critical-env check for CI and the container entrypoint. Intentionally
// mirrors src/lib/config.ts without importing it (no TS step in the image).
const failures = [];
const env = process.env;

if (!env.DATABASE_URL) failures.push("DATABASE_URL is required");
else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL))
  failures.push("DATABASE_URL must be a postgres:// (or postgresql://) URL");

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
  failures.push("JWT_SECRET must be set and at least 32 characters");

if (env.NODE_ENV === "production" && !["true", "1", "yes"].includes((env.TRUST_PROXY || "").toLowerCase()))
  failures.push("TRUST_PROXY must be true in production (rate limiting trusts X-Forwarded-For)");

if (failures.length > 0) {
  console.error("Invalid configuration:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("Configuration OK");
