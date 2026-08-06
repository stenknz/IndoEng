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
