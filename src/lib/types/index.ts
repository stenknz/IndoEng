export type TranslationMode = "beginner" | "intermediate" | "advanced";
export type DifficultyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface User {
  name: string;
  createdAt: number;
}

export interface LearningProfile {
  level: 0 | 1 | 2 | 3 | 4;
  translationMode: TranslationMode;
  pronunciationOn: boolean;
  aiTutorOn: boolean;
  vocabKnowledge: number;
  grammarKnowledge: number;
  conversationAbility: number;
  readingAbility: number;
  listeningAbility: number;
  recentMistakes: number[];
  confidence: number;
  currentDifficulty: DifficultyLevel;
  lastAnswerAccuracy: number;
  consecutiveCorrect: number;
}

export interface VocabularyWord {
  id: string;
  indonesian: string;
  english: string;
  pronunciation: string;
  example: string;
  exampleTranslation: string;
  category: string;
  image?: string;
  frequency: number;
  level: number;
  familiarity: number;
  exposures: number;
  correct: number;
  mistakes: number;
  lastReviewed: number | null;
  nextReview: number | null;
  streak: number;
}

export interface GrammarConcept {
  id: string;
  name: string;
  description: string;
  exposedAt: number | null;
  mastered: boolean;
}

export type LessonStatus = "not_started" | "in_progress" | "complete";

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  completedAt: number | null;
  attempts: number;
}

export interface Lesson {
  id: string;
  title: string;
  emoji: string;
  level: number;
  order: number;
  newWordIds: string[];
  warmUpIds: string[];
  sentences: string[];
  translations?: string[];
  practice: PracticeItem[];
  recall: RecallItem[];
  reviewNote: string;
  grammarNote: string | null;
}

export interface PracticeItem {
  prompt: string;
  expectedWords: string[];
  hint: string;
}

export interface RecallItem {
  indonesian: string;
  english: string;
}

export type MessageKind = "tutor" | "learner" | "system";

export interface ConversationMessage {
  id: string;
  kind: MessageKind;
  content: string;
  timestamp: number;
  hint?: string;
  translation?: string;
}

export interface Conversation {
  id: string;
  lessonId?: string;
  startedAt: number;
  messages: ConversationMessage[];
}

export interface PracticeAttempt {
  id: string;
  ts: number;
  kind: "lesson" | "conversation" | "recall" | "vocab";
  prompt: string;
  learnerAnswer: string;
  expected: string;
  correct: boolean | "partial";
  wordIds: string[];
}

export interface ReviewItem {
  wordId: string;
  due: number;
  intervalDays: number;
}

export interface LearningSession {
  id: string;
  ts: number;
  durationMin: number;
  wordsReviewed: number;
  newWords: number;
  recallRate: number;
}

export interface LearnerState {
  user: User;
  profile: LearningProfile;
  words: Record<string, VocabularyWord>;
  lessons: Record<string, LessonProgress>;
  grammar: Record<string, GrammarConcept>;
  conversations: Conversation[];
  attempts: PracticeAttempt[];
  sessions: LearningSession[];
}
