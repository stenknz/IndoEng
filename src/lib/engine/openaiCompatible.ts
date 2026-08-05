import { metWordIds } from "@/lib/difficulty/learnerModel";
import type { TutorContext, TutorResponse } from "@/lib/engine/provider";
import type { TutorReply } from "@/lib/engine/openaiMessages";

export interface AIProvider {
  generate(ctx: TutorContext): Promise<TutorResponse | null>;
}

export const openaiCompatibleProvider: AIProvider = {
  async generate(ctx: TutorContext): Promise<TutorResponse | null> {
    if (ctx.mode !== "conversation" || !ctx.state.profile.aiTutorOn) {
      return null;
    }
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: ctx.messages.slice(-20),
          input: ctx.input ?? "",
          context: {
            level: ctx.state.profile.level,
            translationMode: ctx.state.profile.translationMode,
            knownWords: metWordIds(ctx.state.words),
          },
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as TutorReply & { error?: string };
      if (!data || typeof data.text !== "string" || data.error) return null;
      return {
        text: data.text,
        hint: data.hint,
        translation: data.translation,
        expectedWords: data.expectedWords,
        expectAnswer: true,
      };
    } catch {
      return null;
    }
  },
};
