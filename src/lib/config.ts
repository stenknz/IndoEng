import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string({ error: "DATABASE_URL" }).min(1, "DATABASE_URL"),
  JWT_SECRET: z.string({ error: "JWT_SECRET" }).min(32, "JWT_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(8),
  REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  TUTOR_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TTS_PROVIDER: z.enum(["piper", "browser"], { error: "TTS_PROVIDER" }).default("piper"),
  PIPER_URL: z.string().url().default("http://piper:5000"),
  TTS_CACHE_DIR: z.string().min(1).default("/data/tts-cache"),
  TTS_DEFAULT_VOICE: z.string().min(1).default("id_ID-news_tts-medium"),
  TTS_LENGTH_SCALE: z.coerce.number().positive().default(1.1),
  TTS_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  ADMIN_PASSWORD: z.string().min(8).optional().or(z.literal("")),
  SMTP_HOST: z.string().optional().or(z.literal("")),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional().or(z.literal("")),
  SMTP_PASS: z.string().optional().or(z.literal("")),
  SMTP_FROM: z.string().email().optional().or(z.literal("")),
  APP_URL: z.string().url().default("http://localhost:3000"),
  // z.coerce.boolean() would parse "false" as true (Boolean("false") === true);
  // parse explicitly so TRUST_PROXY=false is honored.
  TRUST_PROXY: z.string().default("false").transform((v) => ["true", "1", "yes"].includes(v.toLowerCase())),
  COOKIE_SECURE: z.coerce.boolean().default(true),
  OPENCODE_GO_API_KEY: z.string().optional().or(z.literal("")),
  OPENCODE_GO_BASE_URL: z.string().url().default("https://opencode.ai/zen/go/v1"),
  OPENCODE_GO_MODEL: z.string().default("deepseek-v4-flash"),
  NODE_ENV: z.string().default("development"),
}).superRefine((data, ctx) => {
  // With request.ip gone in Next 15, TRUST_PROXY=false collapses every client
  // into one shared rate-limit bucket -> a stock production deploy would lock
  // out all auth. Fail fast instead of shipping a global lockout.
  if (data.NODE_ENV === "production" && data.TRUST_PROXY === false) {
    ctx.addIssue({
      code: "custom",
      message: "TRUST_PROXY must be true behind a reverse proxy",
      path: ["TRUST_PROXY"],
    });
  }
});

export interface AppConfig {
  databaseUrl: string;
  jwtSecret: string;
  sessionTtlHours: number;
  rememberTtlDays: number;
  authRateLimitMax: number;
  tutorRateLimitMax: number;
  tts: { provider: "piper" | "browser"; piperUrl: string; cacheDir: string; defaultVoice: string; lengthScale: number };
  ttsRateLimitMax: number;
  adminEmail: string | null;
  adminPassword: string | null;
  smtp: { host: string | null; port: number; user: string | null; pass: string | null; from: string | null };
  appUrl: string;
  trustProxy: boolean;
  cookieSecure: boolean;
  opencodeGo: { apiKey: string; baseUrl: string; model: string };
  nodeEnv: string;
}

export class ConfigError extends Error {}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.message).join(", ");
    throw new ConfigError(`Invalid configuration. Missing or invalid: ${missing}`);
  }
  const v = parsed.data;
  return {
    databaseUrl: v.DATABASE_URL,
    jwtSecret: v.JWT_SECRET,
    sessionTtlHours: v.SESSION_TTL_HOURS,
    rememberTtlDays: v.REMEMBER_TTL_DAYS,
    authRateLimitMax: v.AUTH_RATE_LIMIT_MAX,
    tutorRateLimitMax: v.TUTOR_RATE_LIMIT_MAX,
    tts: {
      provider: v.TTS_PROVIDER,
      piperUrl: v.PIPER_URL,
      cacheDir: v.TTS_CACHE_DIR,
      defaultVoice: v.TTS_DEFAULT_VOICE,
      lengthScale: v.TTS_LENGTH_SCALE,
    },
    ttsRateLimitMax: v.TTS_RATE_LIMIT_MAX,
    adminEmail: v.ADMIN_EMAIL || null,
    adminPassword: v.ADMIN_PASSWORD || null,
    smtp: {
      host: v.SMTP_HOST || null,
      port: v.SMTP_PORT ?? 587,
      user: v.SMTP_USER || null,
      pass: v.SMTP_PASS || null,
      from: v.SMTP_FROM || null,
    },
    appUrl: v.APP_URL,
    trustProxy: v.TRUST_PROXY,
    cookieSecure: v.COOKIE_SECURE && v.NODE_ENV === "production",
    opencodeGo: { apiKey: v.OPENCODE_GO_API_KEY ?? "", baseUrl: v.OPENCODE_GO_BASE_URL, model: v.OPENCODE_GO_MODEL },
    nodeEnv: v.NODE_ENV,
  };
}

export function validateConfig(env: Record<string, string | undefined> = process.env): { ok: boolean; errors: string[] } {
  const parsed = envSchema.safeParse(env);
  if (parsed.success) return { ok: true, errors: [] };
  return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
}
