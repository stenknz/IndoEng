import { describe, it, expect } from "vitest";
import { loadConfig, validateConfig, ConfigError } from "@/lib/config";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/kak",
  JWT_SECRET: "a".repeat(48),
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "password123",
  NODE_ENV: "development",
};

describe("config", () => {
  it("loads a valid config", () => {
    const c = loadConfig(base);
    expect(c.databaseUrl).toBe(base.DATABASE_URL);
    expect(c.cookieSecure).toBe(false); // dev
    expect(c.authRateLimitMax).toBe(10); // secure default
  });
  it("validates AUTH_RATE_LIMIT_MAX and rejects non-positive values", () => {
    expect(loadConfig({ ...base, AUTH_RATE_LIMIT_MAX: "1000" }).authRateLimitMax).toBe(1000);
    expect(() => loadConfig({ ...base, AUTH_RATE_LIMIT_MAX: "abc" })).toThrow();
    expect(() => loadConfig({ ...base, AUTH_RATE_LIMIT_MAX: "0" })).toThrow();
    expect(() => loadConfig({ ...base, AUTH_RATE_LIMIT_MAX: "-5" })).toThrow();
  });
  it("validates TUTOR_RATE_LIMIT_MAX and rejects non-positive values", () => {
    expect(loadConfig(base).tutorRateLimitMax).toBe(20); // secure default
    expect(loadConfig({ ...base, TUTOR_RATE_LIMIT_MAX: "100" }).tutorRateLimitMax).toBe(100);
    expect(() => loadConfig({ ...base, TUTOR_RATE_LIMIT_MAX: "abc" })).toThrow();
    expect(() => loadConfig({ ...base, TUTOR_RATE_LIMIT_MAX: "0" })).toThrow();
    expect(() => loadConfig({ ...base, TUTOR_RATE_LIMIT_MAX: "-5" })).toThrow();
  });
  it("fails fast when TRUST_PROXY=false in production", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production", TRUST_PROXY: "false" })).toThrow(/TRUST_PROXY/);
    expect(loadConfig({ ...base, NODE_ENV: "production", TRUST_PROXY: "true" }).trustProxy).toBe(true);
  });
  it("does not reject TRUST_PROXY=false outside production", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "development", TRUST_PROXY: "false" })).not.toThrow();
    expect(() => loadConfig({ ...base, NODE_ENV: "test", TRUST_PROXY: "false" })).not.toThrow();
  });
  it("throws a precise error when DATABASE_URL is missing", () => {
    expect(() => loadConfig({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });
  it("rejects a short JWT_SECRET", () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });
  it("validateConfig reports errors without throwing", () => {
    const r = validateConfig({});
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/DATABASE_URL/);
  });
});
