"use client";
import { browserTTS } from "@/lib/audio/browserTTS";
import { piperTTS } from "@/lib/audio/piperTTS";
export { piperTTS };
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

let cached: SpeechProvider | null = null;
let checkedAt = 0;
const TTL = 60_000;

export async function getSpeechProvider(): Promise<SpeechProvider> {
  const now = Date.now();
  if (cached && now - checkedAt < TTL) return cached;
  try {
    const res = await fetch("/api/tts/info", {
      headers: { "x-kak-request": "1" },
      credentials: "same-origin",
    });
    if (res.ok) {
      const info = (await res.json()) as { provider?: string; configured?: boolean; voices?: SpeechProvider["voices"]; defaultVoice?: string };
      if (info.provider === "piper" && info.configured) {
        piperTTS.voices = info.voices ?? [];
        piperTTS.activeVoice = info.defaultVoice ?? "";
        cached = piperTTS;
      } else {
        cached = browserTTS;
      }
    } else {
      cached = browserTTS;
    }
  } catch {
    cached = browserTTS;
  }
  checkedAt = now;
  return cached;
}

export async function speakText(text: string, opts?: { voice?: string }): Promise<boolean> {
  const provider = await getSpeechProvider();
  if (provider === browserTTS) return provider.speak(text, opts);
  const ok = await provider.speak(text, opts);
  if (ok) return true;
  cached = browserTTS; // piper failed — fall back (and remember for the TTL)
  return browserTTS.speak(text, opts);
}
