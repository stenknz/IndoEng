export interface SpeechProvider {
  speak(text: string): boolean;
  supported: boolean;
  voiceAvailable: boolean;
}
