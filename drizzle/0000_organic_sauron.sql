CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"ts" bigint NOT NULL,
	"kind" text NOT NULL,
	"prompt" text NOT NULL,
	"learner_answer" text NOT NULL,
	"expected" text NOT NULL,
	"correct" text NOT NULL,
	"word_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" text,
	"started_at" bigint NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_grammar" (
	"user_id" uuid NOT NULL,
	"concept_id" text NOT NULL,
	"exposed_at" bigint,
	"mastered" text DEFAULT 'false' NOT NULL,
	CONSTRAINT "learner_grammar_user_id_concept_id_pk" PRIMARY KEY("user_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "learner_lessons" (
	"user_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"completed_at" bigint,
	"attempts" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "learner_lessons_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "learner_words" (
	"user_id" uuid NOT NULL,
	"word_id" text NOT NULL,
	"familiarity" bigint DEFAULT 0 NOT NULL,
	"exposures" bigint DEFAULT 0 NOT NULL,
	"correct" bigint DEFAULT 0 NOT NULL,
	"mistakes" bigint DEFAULT 0 NOT NULL,
	"last_reviewed" bigint,
	"next_review" bigint,
	"streak" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "learner_words_user_id_word_id_pk" PRIMARY KEY("user_id","word_id")
);
--> statement-breakpoint
CREATE TABLE "learning_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"ts" bigint NOT NULL,
	"duration_min" bigint NOT NULL,
	"words_reviewed" bigint NOT NULL,
	"new_words" bigint NOT NULL,
	"recall_rate" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"level" bigint DEFAULT 0 NOT NULL,
	"translation_mode" text DEFAULT 'beginner' NOT NULL,
	"pronunciation_on" text DEFAULT 'true' NOT NULL,
	"ai_tutor_on" text DEFAULT 'false' NOT NULL,
	"vocab_knowledge" bigint DEFAULT 0 NOT NULL,
	"grammar_knowledge" bigint DEFAULT 0 NOT NULL,
	"conversation_ability" bigint DEFAULT 0 NOT NULL,
	"reading_ability" bigint DEFAULT 0 NOT NULL,
	"listening_ability" bigint DEFAULT 0 NOT NULL,
	"recent_mistakes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text DEFAULT '0.5' NOT NULL,
	"current_difficulty" bigint DEFAULT 0 NOT NULL,
	"last_answer_accuracy" text DEFAULT '1' NOT NULL,
	"consecutive_correct" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"replaced_by_id" uuid,
	"user_agent" text,
	"ip" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"email_verified_at" bigint,
	"email_verify_token_hash" text,
	"email_verify_token_expires_at" bigint,
	"mfa_secret" text,
	"disabled_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_grammar" ADD CONSTRAINT "learner_grammar_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_lessons" ADD CONSTRAINT "learner_lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_words" ADD CONSTRAINT "learner_words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;