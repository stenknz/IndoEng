import type { LearnerState } from "@/lib/types";
import type { Store } from "@/lib/store/Store";

const KEY = "indo-tutor:v1";

export function createInitialState(name: string): LearnerState {
  return {
    user: { name, createdAt: Date.now() },
    profile: {
      level: 0,
      translationMode: "beginner",
      pronunciationOn: true,
      vocabKnowledge: 0,
      grammarKnowledge: 0,
      conversationAbility: 0,
      readingAbility: 0,
      listeningAbility: 0,
      recentMistakes: [],
      confidence: 0.5,
      currentDifficulty: 0,
      lastAnswerAccuracy: 1,
      consecutiveCorrect: 0,
    },
    words: {},
    lessons: {},
    grammar: {},
    conversations: [],
    attempts: [],
    sessions: [],
  };
}

export function loadState(): LearnerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LearnerState) : null;
  } catch {
    return null;
  }
}

export const localStore: Store = {
  getState(): LearnerState {
    return loadState() ?? createInitialState("Kawan");
  },
  setState(partial: Partial<LearnerState>): void {
    if (typeof window === "undefined") return;
    const next = { ...this.getState(), ...partial };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  },
};
