"use client";
import { browserTTS } from "@/lib/audio/browserTTS";
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

export async function getSpeechProvider(): Promise<SpeechProvider> {
  return browserTTS; // Task 5 replaces this with the /api/tts/info resolver
}

export async function speakText(text: string, opts?: { voice?: string }): Promise<boolean> {
  return (await getSpeechProvider()).speak(text, opts);
}
