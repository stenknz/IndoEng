export interface SpeechProvider {
  speak(text: string): void;
  supported: boolean;
}
