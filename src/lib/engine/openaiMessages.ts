import { TUTOR_PROMPT } from "@/lib/data/tutorPrompt";
import type { ConversationMessage, TranslationMode } from "@/lib/types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LearnerContext {
  level: 0 | 1 | 2 | 3 | 4;
  translationMode: TranslationMode;
  knownWords: string[];
}

export interface TutorReply {
  text: string;
  hint?: string;
  translation?: string;
  expectedWords?: string[];
}

const LEVEL_NAMES: Record<number, string> = {
  0: "complete beginner — survival words (greetings, food, drinks, numbers)",
  1: "beginner — tiny sentences like 'Saya makan'",
  2: "elementary — everyday conversation",
  3: "intermediate — natural conversation, past and future",
  4: "advanced — longer natural Indonesian",
};

const HISTORY_LIMIT = 20;

export function buildOpenAIMessages(params: {
  messages: ConversationMessage[];
  input: string;
  context: LearnerContext;
}): ChatMessage[] {
  const { messages, input, context } = params;
  const levelName = LEVEL_NAMES[context.level] ?? LEVEL_NAMES[0];
  const known = context.knownWords.length
    ? context.knownWords.slice(0, 80).join(", ")
    : "(none yet — use only very simple words)";

  const system = [
    TUTOR_PROMPT,
    "",
    "[Learner context]",
    `- Learner level: ${levelName}`,
    `- Translation mode: ${context.translationMode}`,
    `- Vocabulary the learner already knows (reuse these words when possible): ${known}`,
    "",
    "[Reply format]",
    "Reply ONLY with a JSON object of this exact shape:",
    '{"text": "your Indonesian message(s), always natural, short (1-3 short sentences)", "hint": "optional short English gloss of one key word, or null", "translation": "optional English translation of text, or null", "expectedWords": []}',
    "",
    "Rules:",
    "- text must be natural everyday Indonesian at or just above the learner's level. Never switch to advanced Indonesian.",
    "- End with a question to keep the conversation going, unless the learner asked something that needs answering first.",
    "- Include hint/translation according to the translation mode: beginner = include translation almost always; intermediate = only when the learner seems stuck; advanced = almost never.",
    "- Correct mistakes gently and briefly, then ask again. Recognise partial understanding with 'Hampir!'.",
  ].join("\n");

  const history: ChatMessage[] = messages
    .slice(-HISTORY_LIMIT)
    .map((m): ChatMessage | null => {
      if (m.kind === "learner") return { role: "user", content: m.content };
      if (m.kind === "tutor") return { role: "assistant", content: m.content };
      return null;
    })
    .filter((m): m is ChatMessage => m !== null);

  return [
    { role: "system", content: system },
    ...history,
    { role: "user", content: input },
  ];
}

export function parseTutorReply(content: string): TutorReply {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(content.slice(start, end + 1)) as {
        text?: unknown;
        hint?: unknown;
        translation?: unknown;
        expectedWords?: unknown;
      };
      if (parsed && typeof parsed.text === "string") {
        const expectedWords = Array.isArray(parsed.expectedWords)
          ? parsed.expectedWords.filter(
              (w): w is string => typeof w === "string" && w.trim().length > 0,
            )
          : undefined;
        return {
          text: parsed.text.trim(),
          hint: typeof parsed.hint === "string" ? parsed.hint : undefined,
          translation:
            typeof parsed.translation === "string"
              ? parsed.translation
              : undefined,
          expectedWords: expectedWords && expectedWords.length > 0 ? expectedWords : undefined,
        };
      }
    } catch {
      // fall through to raw-text fallback
    }
  }
  return { text: content.trim() };
}
