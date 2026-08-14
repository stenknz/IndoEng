import "server-only";
import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { loadConfig } from "@/lib/config";
import { HttpError } from "@/lib/auth/requireUser";

export interface TtsVoiceInfo {
  id: string;
  name: string;
  language: string;
}

export function cacheKey(text: string, voice: string): string {
  return createHash("sha256").update(`${text}\u0000${voice}`).digest("hex");
}

const toVoice = (raw: unknown, fallback: string): TtsVoiceInfo => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.id === "string" || typeof r.name === "string") {
      return {
        id: (r.id as string) ?? fallback,
        name: (r.name as string) ?? (r.id as string) ?? fallback,
        language: (r.language as string) ?? "id",
      };
    }
    if (typeof r.key === "string") {
      return { id: r.key as string, name: r.key as string, language: "id" };
    }
  }
  if (typeof raw === "string") return { id: raw, name: raw, language: "id" };
  return { id: fallback, name: fallback, language: "id" };
};

export async function getPiperVoices(): Promise<TtsVoiceInfo[]> {
  const cfg = loadConfig();
  if (cfg.tts.provider !== "piper") return [];
  try {
    const res = await fetch(`${cfg.tts.piperUrl}/voices`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    const list = Array.isArray(data) ? data : (data as { voices?: unknown[] })?.voices ?? [];
    if (!Array.isArray(list)) return [];
    const voices = list.map((v) => toVoice(v, cfg.tts.defaultVoice));
    // Ensure the configured default is always present.
    if (!voices.some((v) => v.id === cfg.tts.defaultVoice)) {
      voices.unshift({ id: cfg.tts.defaultVoice, name: cfg.tts.defaultVoice, language: "id" });
    }
    return voices;
  } catch {
    return [{ id: cfg.tts.defaultVoice, name: cfg.tts.defaultVoice, language: "id" }];
  }
}

export async function synthesize(text: string, voice?: string): Promise<Uint8Array> {
  const cfg = loadConfig();
  const v = voice || cfg.tts.defaultVoice;
  const key = cacheKey(text, v);
  const file = join(cfg.tts.cacheDir, `${key}.wav`);
  try {
    const cached = await readFile(file);
    return new Uint8Array(cached);
  } catch {
    // cache miss — synthesize below
  }
  if (cfg.tts.provider !== "piper") throw new HttpError(503, "TTS provider not configured");
  let res: Response;
  try {
    res = await fetch(`${cfg.tts.piperUrl}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: v, length_scale: cfg.tts.lengthScale }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(502, "TTS provider unavailable");
  }
  if (!res.ok) throw new HttpError(502, "TTS provider error");
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(cfg.tts.cacheDir, { recursive: true });
  await writeFile(file, buf);
  return new Uint8Array(buf);
}

export async function ttsInfo(): Promise<{ provider: "piper" | "browser"; configured: boolean; voices: TtsVoiceInfo[]; defaultVoice: string }> {
  const cfg = loadConfig();
  const configured = cfg.tts.provider === "piper" && Boolean(cfg.tts.piperUrl);
  return {
    provider: cfg.tts.provider,
    configured,
    voices: configured ? await getPiperVoices() : [],
    defaultVoice: cfg.tts.defaultVoice,
  };
}
