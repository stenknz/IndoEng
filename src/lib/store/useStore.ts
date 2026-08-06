import { create } from "zustand";
import type {
  Conversation,
  LearningSession,
  LessonProgress,
  LearnerState,
  PracticeAttempt,
  VocabularyWord,
} from "@/lib/types";
import { createInitialState } from "@/lib/store/localStore";
import { scheduler } from "@/lib/srs/scheduler";
import { WORD_BANK } from "@/lib/data/words";
import {
  loadStateFromServer,
  renameUserOnServer,
  resetStateOnServer,
  saveAttempt,
  saveConversation,
  saveLessonProgress,
  saveProfile,
  saveSession,
  saveWordResult,
  touchWordOnServer,
} from "@/lib/api/actions";

export type WordResult = "correct" | "partial" | "wrong";

interface TutorState {
  state: LearnerState;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUser: (name: string) => void;
  updateProfile: (partial: Partial<LearnerState["profile"]>) => void;
  recordAttempt: (a: PracticeAttempt) => void;
  saveConversation: (c: Conversation) => void;
  addSession: (s: LearningSession) => void;
  setLessonProgress: (id: string, status: LessonProgress["status"]) => void;
  bumpWord: (id: string, result: WordResult) => void;
  touchWord: (id: string) => void;
  resetAll: () => Promise<void>;
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
    image: undefined,
    frequency: 0,
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

  hydrate: async () => {
    const s = await loadStateFromServer();
    set({ state: s, hydrated: true });
  },

  setUser: (name) => {
    const state = { ...get().state, user: { ...get().state.user, name } };
    set({ state });
    void renameUserOnServer(name).catch(() => {});
  },

  updateProfile: (partial) => {
    const state = {
      ...get().state,
      profile: { ...get().state.profile, ...partial },
    };
    set({ state });
    void saveProfile(partial).catch(() => {});
  },

  recordAttempt: (a) => {
    const withId: PracticeAttempt = a.id ? a : { ...a, id: crypto.randomUUID() };
    const profile = {
      ...get().state.profile,
      consecutiveCorrect:
        withId.correct === true ? get().state.profile.consecutiveCorrect + 1 : 0,
      lastAnswerAccuracy: withId.correct === true ? 1 : 0,
    };
    const state = {
      ...get().state,
      profile,
      attempts: [...get().state.attempts, withId],
    };
    set({ state });
    void saveAttempt(withId).catch(() => {});
  },

  saveConversation: (c) => {
    const withId: Conversation = c.id ? c : { ...c, id: crypto.randomUUID() };
    const conversations = [
      ...get().state.conversations.filter((x) => x.id !== withId.id),
      withId,
    ];
    const state = { ...get().state, conversations };
    set({ state });
    void saveConversation(withId).catch(() => {});
  },

  addSession: (s) => {
    const withId: LearningSession = s.id ? s : { ...s, id: crypto.randomUUID() };
    const state = { ...get().state, sessions: [...get().state.sessions, withId] };
    set({ state });
    void saveSession(withId).catch(() => {});
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
    set({ state });
    void saveLessonProgress(id, status).catch(() => {});
  },

  bumpWord: (id, result) => {
    const next = scheduler.recordResult(get().state.words[id] ?? emptyWord(id), result);
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
      words: { ...get().state.words, [id]: next },
    };
    set({ state });
    void saveWordResult(id, result)
      .then((server) => {
        if (server.streak !== next.streak) {
          set((s) => ({ state: { ...s.state, words: { ...s.state.words, [id]: server } } }));
        }
      })
      .catch(() => {});
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
    set({ state });
    void touchWordOnServer(id).catch(() => {});
  },

  resetAll: async () => {
    set({ state: createInitialState(get().state.user.name) });
    try {
      await resetStateOnServer();
      await get().hydrate();
    } catch {
      // Server unreachable or unauthenticated: the optimistic local reset stands.
    }
  },
}));
