import { matchAnswer } from "@/lib/engine/matcher";
import { buildCorrection } from "@/lib/engine/engine";
import type { LanguageModelProvider, TutorContext, TutorResponse } from "@/lib/engine/provider";
import { computeLearnerStats, metWordIds } from "@/lib/difficulty/learnerModel";
import { simplifyUtterance } from "@/lib/difficulty/simplify";
import type { PracticeItem, VocabularyWord } from "@/lib/types";

const KNOWN_FOOD = new Set(["nasi", "ayam", "ikan", "roti", "makanan", "sate"]);
const KNOWN_DRINKS = new Set(["air", "kopi", "teh", "susu", "minuman"]);
const KNOWN_OBJECTS = new Set(["rumah", "pintu", "kamar", "jendela", "dapur", "buku", "barang"]);
const KNOWN_VERBS = new Set(["makan", "minum", "mau", "suka", "beli", "pesan", "tidur"]);

function knownWords(ctx: TutorContext): VocabularyWord[] {
  return metWordIds(ctx.state.words)
    .map((id) => ctx.state.words[id])
    .filter(Boolean);
}

function withinBudget(ctx: TutorContext, text: string): string {
  const budget = 6 + ctx.state.profile.currentDifficulty * 2;
  if (text.trim().split(/\s+/).length > budget) return simplifyUtterance(text);
  return text;
}

// The active practice item is derived from the message history: the last tutor
// message that (exactly) asks a practice prompt. The longest matching prompt
// wins so "Berapa?" never shadows "Satu, dua, tiga. Berapa?". When prompts tie
// (e.g. two "Ini apa?" items), the hint stored on the tutor message identifies
// which item was actually asked.
function findActiveItem(ctx: TutorContext): { index: number; item: PracticeItem } | null {
  const practice = ctx.lesson.practice;
  if (practice.length === 0) return null;
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const m = ctx.messages[i];
    if (m.kind !== "tutor") continue;
    let best: { index: number; item: PracticeItem } | null = null;
    for (let j = 0; j < practice.length; j++) {
      const p = practice[j];
      if (m.content !== p.prompt && !m.content.endsWith(p.prompt)) continue;
      if (m.hint !== undefined && m.hint !== p.hint) continue;
      if (!best || p.prompt.length >= best.item.prompt.length) {
        best = { index: j, item: p };
      }
    }
    if (best) return best;
  }
  return null;
}

async function lesson(ctx: TutorContext): Promise<TutorResponse> {
  const practice = ctx.lesson.practice;
  if (practice.length === 0) {
    return { text: "Hari ini tidak ada latihan. Ayo ngobrol!", expectAnswer: true };
  }
  const active = findActiveItem(ctx) ?? { index: 0, item: practice[0] };
  const { index, item } = active;

  if (!ctx.input) {
    return {
      text: withinBudget(ctx, item.prompt),
      hint: item.hint,
      expectedWords: item.expectedWords,
      expectAnswer: true,
    };
  }

  const result = matchAnswer(ctx.input, item.expectedWords);
  if (result.correct === true) {
    if (index + 1 < practice.length) {
      const next = practice[index + 1];
      return {
        text: withinBudget(ctx, `Bagus! 🙂 ${next.prompt}`),
        hint: next.hint,
        expectedWords: item.expectedWords,
        expectAnswer: true,
      };
    }
    return {
      text: "Bagus! 🙂 Kamu sudah selesai. Sampai jumpa lagi!",
      expectedWords: item.expectedWords,
      expectAnswer: false,
    };
  }

  const prefix = result.correct === "partial" ? "Hampir! " : "";
  const correction = buildCorrection(ctx.lesson, ctx.input, item.expectedWords);
  return {
    text: withinBudget(ctx, `${prefix}${correction} ${item.prompt}`),
    hint: item.hint,
    expectedWords: item.expectedWords,
    expectAnswer: true,
  };
}

function struggling(ctx: TutorContext): boolean {
  const stats = computeLearnerStats(ctx.state.words, ctx.state.attempts, ctx.state.profile);
  return stats.accuracy < 0.5;
}

// Builds the question asked when the learner has completed `step` prior turns.
// Deterministic in `step` so the active question can be reconstructed from the
// message history alone when the next input arrives.
function questionAt(ctx: TutorContext, step: number): TutorResponse {
  const words = knownWords(ctx);
  const food = words.find((w) => KNOWN_FOOD.has(w.id));
  const drink = words.find((w) => KNOWN_DRINKS.has(w.id));
  const object = words.find((w) => KNOWN_OBJECTS.has(w.id));
  const verb = words.find((w) => KNOWN_VERBS.has(w.id) && w.id !== "makan") ?? words.find((w) => KNOWN_VERBS.has(w.id));
  const anyWord = words.length > 0 ? words[step % words.length] : undefined;
  const fallback: TutorResponse = {
    text: "Ini apa?",
    hint: "Kamu bisa bilang: Ini …",
    expectedWords: [],
    expectAnswer: true,
  };

  switch (step % 6) {
    case 0:
      return object
        ? { text: "Ini apa?", expectedWords: [object.id], hint: `Say "Ini ${object.indonesian}"`, expectAnswer: true }
        : fallback;
    case 1:
      return anyWord
        ? { text: `Kamu suka ${anyWord.indonesian}?`, expectedWords: ["suka", anyWord.id], hint: `Say "Saya suka ${anyWord.indonesian}"`, expectAnswer: true }
        : fallback;
    case 2:
      return drink
        ? { text: `Kamu mau ${drink.indonesian}?`, expectedWords: ["mau", drink.id], hint: `Say "Saya mau ${drink.indonesian}"`, expectAnswer: true }
        : fallback;
    case 3:
      return food
        ? { text: "Kamu makan apa?", expectedWords: ["makan", food.id], hint: `Say "Saya makan ${food.indonesian}"`, expectAnswer: true }
        : fallback;
    case 4:
      return verb
        ? { text: `Kamu ${verb.indonesian} apa?`, expectedWords: [verb.id], hint: `Say "Saya ${verb.indonesian}..."`, expectAnswer: true }
        : fallback;
    default:
      return object
        ? { text: `${object.indonesian} apa ini?`, expectedWords: [object.id], hint: `Say "Ini ${object.indonesian}"`, expectAnswer: true }
        : fallback;
  }
}

// The active question index is the number of correctly-answered turns so far.
// Every "Bagus!" reply advances it; corrections re-ask the same question. This
// is deterministic in the message history so the question can be reconstructed
// when the next input arrives.
function conversationStep(ctx: TutorContext): number {
  return ctx.messages.filter(
    (m) => m.kind === "tutor" && m.content.startsWith("Bagus!"),
  ).length;
}

async function conversation(ctx: TutorContext): Promise<TutorResponse> {
  const step = conversationStep(ctx);
  const active = questionAt(ctx, step);

  if (!ctx.input) {
    return { ...active, text: withinBudget(ctx, active.text) };
  }

  // The opening seeds are greetings that ask nothing. The first unprompted
  // learner turn is acknowledged and question 0 is displayed without scoring
  // it, so an answer is never graded against a question that wasn't asked.
  const questionAsked = ctx.messages.some(
    (m) => m.kind === "tutor" && m.hint !== undefined,
  );
  if (!questionAsked) {
    return {
      text: withinBudget(ctx, `Halo! Ayo ngobrol. ${active.text}`),
      hint: active.hint,
      expectedWords: undefined,
      expectAnswer: true,
    };
  }

  const result = matchAnswer(ctx.input, active.expectedWords ?? []);
  if (result.correct === true) {
    const next = questionAt(ctx, step + 1);
    const nextText = struggling(ctx) ? simplifyUtterance(next.text) : next.text;
    return {
      text: withinBudget(ctx, `Bagus! 🙂 ${ctx.input.trim()} ${nextText}`),
      hint: next.hint,
      expectedWords: active.expectedWords ?? [],
      expectAnswer: true,
    };
  }

  const prefix = result.correct === "partial" ? "Hampir! " : "";
  const correction = buildCorrection(ctx.lesson, ctx.input, active.expectedWords ?? []);
  return {
    text: withinBudget(ctx, `${prefix}${correction} ${active.text}`),
    hint: active.hint,
    expectedWords: active.expectedWords,
    expectAnswer: true,
  };
}

export const scriptedProvider: LanguageModelProvider = {
  async generate(ctx: TutorContext): Promise<TutorResponse> {
    if (ctx.mode === "lesson") return lesson(ctx);
    return conversation(ctx);
  },
};
