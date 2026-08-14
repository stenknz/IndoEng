export interface SpeechVoice {
  id: string;
  name: string;
  language: string;
}

export interface SpeechProvider {
  speak(text: string, opts?: { voice?: string; language?: string }): Promise<boolean>;
  supported: boolean;
  voices: SpeechVoice[];
  activeVoice: string;
}
