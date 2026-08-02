import { create } from "zustand";
import type {
  Conversation,
  LearningSession,
  LessonProgress,
  PracticeAttempt,
  VocabularyWord,
} from "@/lib/types";
import { createInitialState, localStore } from "@/lib/store/localStore";
import type { Store } from "@/lib/store/Store";
import { scheduler } from "@/lib/srs/scheduler";
import { WORD_BANK } from "@/lib/data/words";

export type WordResult = "correct" | "partial" | "wrong";

interface TutorState {
  state: ReturnType<typeof localStore.getState>;
  hydrated: boolean;
  hydrate: () => void;
  setUser: (name: string) => void;
  updateProfile: (partial: Partial<TutorState["state"]["profile"]>) => void;
  recordAttempt: (a: PracticeAttempt) => void;
  saveConversation: (c: Conversation) => void;
  addSession: (s: LearningSession) => void;
  setLessonProgress: (id: string, status: LessonProgress["status"]) => void;
  bumpWord: (id: string, result: WordResult) => void;
  touchWord: (id: string) => void;
  resetAll: () => void;
}

function emptyWord(id: string): VocabularyWord {
  return {
    id,
    indonesian: "",
    english: "",
    pronunciation: "",
    example: "",
    exampleTranslation: "",
    category: "",
    level: 0,
    familiarity: 0,
    exposures: 0,
    correct: 0,
    mistakes: 0,
    lastReviewed: null,
    nextReview: null,
    streak: 0,
  };
}

export const useStore = create<TutorState>((set, get) => ({
  state: createInitialState("Kawan"),
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    set({ state: localStore.getState(), hydrated: true });
  },

  setUser: (name) => {
    const state = { ...get().state, user: { ...get().state.user, name } };
    localStore.setState(state);
    set({ state });
  },

  updateProfile: (partial) => {
    const state = {
      ...get().state,
      profile: { ...get().state.profile, ...partial },
    };
    localStore.setState(state);
    set({ state });
  },

  recordAttempt: (a) => {
    const profile = {
      ...get().state.profile,
      consecutiveCorrect:
        a.correct === true ? get().state.profile.consecutiveCorrect + 1 : 0,
      lastAnswerAccuracy: a.correct === true ? 1 : 0,
    };
    const state = {
      ...get().state,
      profile,
      attempts: [...get().state.attempts, a],
    };
    localStore.setState(state);
    set({ state });
  },

  saveConversation: (c) => {
    const conversations = [
      ...get().state.conversations.filter((x) => x.id !== c.id),
      c,
    ];
    const state = { ...get().state, conversations };
    localStore.setState(state);
    set({ state });
  },

  addSession: (s) => {
    const state = { ...get().state, sessions: [...get().state.sessions, s] };
    localStore.setState(state);
    set({ state });
  },

  setLessonProgress: (id, status) => {
    const prev = get().state.lessons[id];
    const lessons = {
      ...get().state.lessons,
      [id]: {
        lessonId: id,
        status,
        completedAt: status === "complete" ? Date.now() : (prev?.completedAt ?? null),
        attempts: prev ? prev.attempts + 1 : 1,
      },
    };
    const state = { ...get().state, lessons };
    localStore.setState(state);
    set({ state });
  },

  bumpWord: (id, result) => {
    const word = scheduler.recordResult(get().state.words[id] ?? emptyWord(id), result);
    const profile =
      result === "wrong"
        ? {
            ...get().state.profile,
            recentMistakes: [...get().state.profile.recentMistakes, Date.now()].slice(-5),
          }
        : get().state.profile;
    const state = {
      ...get().state,
      profile,
      words: { ...get().state.words, [id]: word },
    };
    localStore.setState(state);
    set({ state });
  },

  touchWord: (id) => {
    const bank = WORD_BANK.find((w) => w.id === id);
    const prev = get().state.words[id];
    const tracking = prev
      ? {
          familiarity: prev.familiarity,
          exposures: prev.exposures,
          correct: prev.correct,
          mistakes: prev.mistakes,
          lastReviewed: prev.lastReviewed,
          nextReview: prev.nextReview,
          streak: prev.streak,
        }
      : {};
    const next: VocabularyWord = {
      ...emptyWord(id),
      ...(bank ?? {}),
      ...tracking,
      lastReviewed: Date.now(),
      exposures: (prev?.exposures ?? 0) + 1,
    };
    const state = {
      ...get().state,
      words: { ...get().state.words, [id]: next },
    };
    localStore.setState(state);
    set({ state });
  },

  resetAll: () => {
    const state = createInitialState(get().state.user.name);
    localStore.setState(state);
    set({ state });
  },
}));
