import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!hasSpeech) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith("id")) ?? undefined;
}

export const browserTTS: SpeechProvider = {
  supported: hasSpeech,
  speak(text: string): void {
    if (!hasSpeech) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  },
};
