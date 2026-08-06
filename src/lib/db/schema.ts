import { bigint, jsonb, pgTable, primaryKey, text, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("student"),
  emailVerifiedAt: bigint("email_verified_at", { mode: "number" }),
  emailVerifyTokenHash: text("email_verify_token_hash"),
  emailVerifyTokenExpiresAt: bigint("email_verify_token_expires_at", { mode: "number" }),
  mfaSecret: text("mfa_secret"),
  disabledAt: bigint("disabled_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  replacedById: uuid("replaced_by_id"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  level: bigint("level", { mode: "number" }).notNull().default(0),
  translationMode: text("translation_mode").notNull().default("beginner"),
  pronunciationOn: text("pronunciation_on").notNull().default("true"),
  aiTutorOn: text("ai_tutor_on").notNull().default("false"),
  vocabKnowledge: bigint("vocab_knowledge", { mode: "number" }).notNull().default(0),
  grammarKnowledge: bigint("grammar_knowledge", { mode: "number" }).notNull().default(0),
  conversationAbility: bigint("conversation_ability", { mode: "number" }).notNull().default(0),
  readingAbility: bigint("reading_ability", { mode: "number" }).notNull().default(0),
  listeningAbility: bigint("listening_ability", { mode: "number" }).notNull().default(0),
  recentMistakes: jsonb("recent_mistakes").notNull().default([]),
  confidence: text("confidence").notNull().default("0.5"),
  currentDifficulty: bigint("current_difficulty", { mode: "number" }).notNull().default(0),
  lastAnswerAccuracy: text("last_answer_accuracy").notNull().default("1"),
  consecutiveCorrect: bigint("consecutive_correct", { mode: "number" }).notNull().default(0),
});

export const learnerWords = pgTable("learner_words", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wordId: text("word_id").notNull(),
  familiarity: bigint("familiarity", { mode: "number" }).notNull().default(0),
  exposures: bigint("exposures", { mode: "number" }).notNull().default(0),
  correct: bigint("correct", { mode: "number" }).notNull().default(0),
  mistakes: bigint("mistakes", { mode: "number" }).notNull().default(0),
  lastReviewed: bigint("last_reviewed", { mode: "number" }),
  nextReview: bigint("next_review", { mode: "number" }),
  streak: bigint("streak", { mode: "number" }).notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.wordId] })]);

export const learnerLessons = pgTable("learner_lessons", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull(),
  status: text("status").notNull().default("not_started"),
  completedAt: bigint("completed_at", { mode: "number" }),
  attempts: bigint("attempts", { mode: "number" }).notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.lessonId] })]);

export const learnerGrammar = pgTable("learner_grammar", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conceptId: text("concept_id").notNull(),
  exposedAt: bigint("exposed_at", { mode: "number" }),
  mastered: text("mastered").notNull().default("false"),
}, (t) => [primaryKey({ columns: [t.userId, t.conceptId] })]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id"),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  messages: jsonb("messages").notNull().default([]),
});

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ts: bigint("ts", { mode: "number" }).notNull(),
  kind: text("kind").notNull(),
  prompt: text("prompt").notNull(),
  learnerAnswer: text("learner_answer").notNull(),
  expected: text("expected").notNull(),
  correct: text("correct").notNull(),
  wordIds: jsonb("word_ids").notNull().default([]),
});

export const learningSessions = pgTable("learning_sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ts: bigint("ts", { mode: "number" }).notNull(),
  durationMin: bigint("duration_min", { mode: "number" }).notNull(),
  wordsReviewed: bigint("words_reviewed", { mode: "number" }).notNull(),
  newWords: bigint("new_words", { mode: "number" }).notNull(),
  recallRate: text("recall_rate").notNull(),
});
