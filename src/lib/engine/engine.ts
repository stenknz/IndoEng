import { matchAnswer } from "@/lib/engine/matcher";
import { scriptedProvider } from "@/lib/engine/scripted";
import type { LanguageModelProvider, TutorContext, TutorResponse } from "@/lib/engine/provider";
import { adaptProfile, computeLearnerStats } from "@/lib/difficulty/learnerModel";
import type { ConversationMessage, LearnerState, LearningProfile, Lesson, PracticeAttempt } from "@/lib/types";
import type { WordResult } from "@/lib/store/useStore";

export class TutorEngine {
  constructor(private provider: LanguageModelProvider = scriptedProvider) {}

  async startLesson(state: LearnerState, lesson: Lesson): Promise<ConversationMessage[]> {
    const opening: ConversationMessage[] = [
      { id: crypto.randomUUID(), kind: "tutor", content: `Halo! 👋`, timestamp: Date.now() },
      { id: crypto.randomUUID(), kind: "tutor", content: `Hari ini kita belajar: ${lesson.emoji} ${lesson.title}`, timestamp: Date.now() },
    ];
    return opening;
  }

  async respond(
    state: LearnerState,
    lesson: Lesson,
    messages: ConversationMessage[],
    input: string,
    mode: "lesson" | "conversation",
  ): Promise<{
    message: ConversationMessage;
    attempts: PracticeAttempt[];
    wordsToRecord: Record<string, WordResult>;
    adaptedProfile: LearningProfile;
  }> {
    const ctx: TutorContext = { state, lesson, messages, input, mode };
    const res: TutorResponse = await this.provider.generate(ctx);
    const stats = computeLearnerStats(state.words, state.attempts, state.profile);
    const adapted = adaptProfile(state.profile, stats);
    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      kind: "tutor",
      content: res.text,
      timestamp: Date.now(),
      hint: res.hint,
      translation: res.translation,
    };
    const attempts: PracticeAttempt[] = [];
    const wordsToRecord: Record<string, WordResult> = {};
    if (input) {
      const expected = res.expectedWords ?? [];
      const result = matchAnswer(input, expected);
      attempts.push({
        id: crypto.randomUUID(),
        ts: Date.now(),
        kind: mode,
        prompt: ctx.messages[ctx.messages.length - 1]?.content ?? "",
        learnerAnswer: input,
        expected: expected.join(" "),
        correct: result.correct,
        wordIds: expected,
      });
      for (const id of expected) {
        wordsToRecord[id] = result.correct === true ? "correct" : result.correct === "partial" ? "partial" : "wrong";
      }
    }
    // persist adaptation hint into state via return value; the caller applies adaptProfile
    return { message, attempts, wordsToRecord, adaptedProfile: adapted };
  }
}

export function buildCorrection(lesson: Lesson, input: string, expected: string[]): string {
  const fallback = expected.length > 0 ? `"${expected.join(" ")}"` : "";
  const example =
    lesson.sentences.find(
      (s) => expected.length > 0 && expected.every((e) => s.toLowerCase().includes(e.toLowerCase())),
    ) ?? fallback;
  if (!example) return "Coba lagi.";
  const clean = example.replace(/[.!?]\s*$/, "");
  return `Kamu bisa bilang: ${clean}. Coba lagi.`;
}
