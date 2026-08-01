import type { ConversationMessage, LearnerState, Lesson } from "@/lib/types";

export interface TutorContext {
  state: LearnerState;
  lesson: Lesson;
  messages: ConversationMessage[];
  input?: string;
  mode: "lesson" | "conversation";
}

export interface TutorResponse {
  text: string;
  hint?: string;
  translation?: string;
  expectAnswer: boolean;
  expectedWords?: string[];
}

export interface LanguageModelProvider {
  generate(ctx: TutorContext): Promise<TutorResponse>;
}
