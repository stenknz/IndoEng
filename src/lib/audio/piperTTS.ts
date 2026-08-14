"use client";
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

let audioEl: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

async function fetchWav(text: string, voice?: string): Promise<Blob | null> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json", "x-kak-request": "1" },
    body: JSON.stringify({ text, voice }),
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  return res.blob();
}

export const piperTTS: SpeechProvider = {
  supported: true,
  voices: [],
  activeVoice: "",
  async speak(text: string, opts?: { voice?: string }): Promise<boolean> {
    try {
      const blob = await fetchWav(text, opts?.voice);
      if (!blob) return false;
      const el = getAudio();
      if (!el) return false;
      const url = URL.createObjectURL(blob);
      el.src = url;
      await el.play();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return true;
    } catch {
      return false;
    }
  },
};
