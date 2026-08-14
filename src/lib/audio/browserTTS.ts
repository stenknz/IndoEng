import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

let idVoice: SpeechSynthesisVoice | undefined;

function refreshVoices(): void {
  if (!hasSpeech) return;
  const voices = window.speechSynthesis.getVoices();
  idVoice = voices.find((v) => v.lang.toLowerCase().startsWith("id"));
}

if (hasSpeech) {
  refreshVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

export const browserTTS: SpeechProvider & { voiceAvailable: boolean } = {
  supported: hasSpeech,
  voices: [],
  activeVoice: "",
  get voiceAvailable(): boolean {
    return hasSpeech && Boolean(idVoice);
  },
  async speak(text: string): Promise<boolean> {
    // Never read Indonesian with a non-Indonesian voice — that sounds wrong.
    if (!hasSpeech || !idVoice) return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    utter.voice = idVoice;
    window.speechSynthesis.speak(utter);
    return true;
  },
};
