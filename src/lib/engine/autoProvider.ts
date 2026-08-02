import { scriptedProvider } from "@/lib/engine/scripted";
import { openaiCompatibleProvider } from "@/lib/engine/openaiCompatible";
import type {
  LanguageModelProvider,
  TutorContext,
  TutorResponse,
} from "@/lib/engine/provider";

export const autoProvider: LanguageModelProvider = {
  async generate(ctx: TutorContext): Promise<TutorResponse> {
    const ai = await openaiCompatibleProvider.generate(ctx);
    if (ai) return ai;
    return scriptedProvider.generate(ctx);
  },
};
