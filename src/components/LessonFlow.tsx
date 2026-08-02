"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store/useStore";
import { TutorEngine } from "@/lib/engine/engine";
import { matchAnswer } from "@/lib/engine/matcher";
import { browserTTS } from "@/lib/audio/browserTTS";
import { WORD_BANK } from "@/lib/data/words";
import type {
  ConversationMessage,
  Lesson,
  PracticeAttempt,
  VocabularyWord,
} from "@/lib/types";

type Step = "warmup" | "newwords" | "conversation" | "practice" | "recall" | "review";

const STEP_ORDER: Record<Step, number> = {
  warmup: 1,
  newwords: 2,
  conversation: 3,
  practice: 4,
  recall: 5,
  review: 6,
};

const STEP_LABELS: Record<Step, string> = {
  warmup: "Pemanasan",
  newwords: "Kata Baru",
  conversation: "Percakapan",
  practice: "Latihan",
  recall: "Ingatan",
  review: "Review",
};

function wordById(id: string): VocabularyWord | undefined {
  return WORD_BANK.find((w) => w.id === id);
}

function SpeakButton({ text }: { text: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !browserTTS.supported) return null;
  return (
    <button
      type="button"
      onClick={() => browserTTS.speak(text)}
      aria-label={`Dengarkan ${text}`}
      className="rounded-full bg-brand-50 p-2.5 text-base text-brand-700 transition hover:bg-brand-100"
    >
      🔊
    </button>
  );
}

function ChatBubble({
  kind,
  children,
}: {
  kind: "tutor" | "learner";
  children: React.ReactNode;
}) {
  const tutor = kind === "tutor";
  return (
    <div className={`flex ${tutor ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          tutor
            ? "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
            : "rounded-br-sm bg-brand-600 text-white"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function LessonFlow({ lesson }: { lesson: Lesson }) {
  const router = useRouter();
  const state = useStore((s) => s.state);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const addSession = useStore((s) => s.addSession);
  const setLessonProgress = useStore((s) => s.setLessonProgress);
  const bumpWord = useStore((s) => s.bumpWord);
  const updateProfile = useStore((s) => s.updateProfile);
  const touchWord = useStore((s) => s.touchWord);

  const engineRef = useRef<TutorEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TutorEngine();
  const engine = engineRef.current;

  const startedAt = useRef(Date.now());
  const touchedRef = useRef<Set<string>>(new Set());
  const finishingRef = useRef(false);

  const [step, setStep] = useState<Step>("warmup");
  const [mistakes, setMistakes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);

  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceMessages, setPracticeMessages] = useState<ConversationMessage[]>([]);
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null);
  const [practiceFeedbackType, setPracticeFeedbackType] = useState<"ok" | "warn" | "err" | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const [recallIndex, setRecallIndex] = useState(0);
  const [recallInput, setRecallInput] = useState("");
  const [recallFeedback, setRecallFeedback] = useState<string | null>(null);
  const [recallFeedbackType, setRecallFeedbackType] = useState<"ok" | "warn" | null>(null);
  const [recallFails, setRecallFails] = useState(0);
  const [recallRevealed, setRecallRevealed] = useState(false);

  const warmUp = lesson.warmUpIds.map(wordById).filter((w): w is VocabularyWord => Boolean(w));
  const newWords = lesson.newWordIds.map(wordById).filter((w): w is VocabularyWord => Boolean(w));

  function makePracticeMessages(index: number): ConversationMessage[] {
    const item = lesson.practice[index];
    return [
      {
        id: crypto.randomUUID(),
        kind: "tutor",
        content: item.prompt,
        hint: item.hint,
        timestamp: Date.now(),
      },
    ];
  }

  function startPractice() {
    setStep(lesson.practice.length === 0 ? "recall" : "practice");
    setPracticeIndex(0);
    setPracticeMessages(lesson.practice.length === 0 ? [] : makePracticeMessages(0));
    setPracticeInput("");
    setPracticeFeedback(null);
    setPracticeFeedbackType(null);
  }

  function goToRecall() {
    setStep(lesson.recall.length === 0 ? "review" : "recall");
  }

  async function handlePracticeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = practiceInput.trim();
    if (!input || practiceBusy || practiceFeedbackType === "ok") return;
    setPracticeBusy(true);
    setPracticeError(null);
    const item = lesson.practice[practiceIndex];
    const learnerMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      kind: "learner",
      content: input,
      timestamp: Date.now(),
    };
    const history = [...practiceMessages, learnerMsg];
    try {
      const out = await engine.respond(useStore.getState().state, lesson, history, input, "lesson");
      const updated = [...history, out.message];
      setPracticeMessages(updated);
      setPracticeInput("");
      for (const a of out.attempts) recordAttempt(a);
      for (const [id, res] of Object.entries(out.wordsToRecord)) {
        touchedRef.current.add(id);
        bumpWord(id, res);
      }
      updateProfile({
        currentDifficulty: out.adaptedProfile.currentDifficulty,
        level: out.adaptedProfile.level,
      });
      const result = out.attempts[0]?.correct;
      setTotalAttempts((t) => t + 1);
      if (result === true) {
        setCorrectCount((c) => c + 1);
        setPracticeFeedbackType("ok");
        setPracticeFeedback("Bagus! 🙂");
        const idx = practiceIndex;
        setTimeout(() => {
          if (idx + 1 < lesson.practice.length) {
            setPracticeIndex(idx + 1);
            setPracticeMessages(makePracticeMessages(idx + 1));
            setPracticeFeedback(null);
            setPracticeFeedbackType(null);
          } else {
            goToRecall();
          }
        }, 900);
      } else {
        setMistakes((m) => m + 1);
        setPracticeFeedbackType(result === "partial" ? "warn" : "err");
        setPracticeFeedback(out.message.content);
      }
    } catch {
      setPracticeMessages(practiceMessages);
      setPracticeError("Ada masalah. Coba lagi. 🙏");
    } finally {
      setPracticeBusy(false);
    }
  }

  function handleRecallSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = recallInput.trim();
    if (!input || recallRevealed) return;
    const item = lesson.recall[recallIndex];
    const result = matchAnswer(input, [item.indonesian]);
    const word = WORD_BANK.find(
      (w) => w.indonesian.toLowerCase() === item.indonesian.toLowerCase(),
    );
    const wordResult =
      result.correct === true ? "correct" : result.correct === "partial" ? "partial" : "wrong";
    if (word) {
      touchedRef.current.add(word.id);
      bumpWord(word.id, wordResult);
    }
    recordAttempt({
      id: crypto.randomUUID(),
      ts: Date.now(),
      kind: "recall",
      prompt: item.english,
      learnerAnswer: input,
      expected: item.indonesian,
      correct: result.correct,
      wordIds: word ? [word.id] : [],
    });
    setRecallInput("");
    setTotalAttempts((t) => t + 1);
    if (result.correct === true) {
      setCorrectCount((c) => c + 1);
      setRecallFeedback(`Bagus! 🙂 ${item.indonesian} = ${item.english}`);
      setRecallFeedbackType("ok");
      const idx = recallIndex;
      setTimeout(() => {
        if (idx + 1 < lesson.recall.length) {
          setRecallIndex(idx + 1);
          setRecallInput("");
          setRecallFeedback(null);
          setRecallFeedbackType(null);
          setRecallFails(0);
          setRecallRevealed(false);
        } else {
          setStep("review");
        }
      }, 900);
    } else {
      setMistakes((m) => m + 1);
      setRecallFeedbackType("warn");
      const fails = recallFails + 1;
      setRecallFails(fails);
      if (fails >= 2) {
        setRecallRevealed(true);
        setRecallFeedback(`Ingat: ${item.indonesian} = ${item.english}. Sekarang kamu sudah tahu!`);
      } else {
        setRecallFeedback(`Ingat: ${item.indonesian} = ${item.english}. Coba lagi?`);
      }
    }
  }

  function nextRecall() {
    if (recallIndex + 1 < lesson.recall.length) {
      setRecallIndex(recallIndex + 1);
      setRecallInput("");
      setRecallFeedback(null);
      setRecallFeedbackType(null);
      setRecallFails(0);
      setRecallRevealed(false);
    } else {
      setStep("review");
    }
  }

  function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    for (const id of lesson.newWordIds) touchWord(id);
    const durationMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const recallRate = totalAttempts === 0 ? 1 : correctCount / totalAttempts;
    addSession({
      id: crypto.randomUUID(),
      ts: Date.now(),
      durationMin,
      wordsReviewed: touchedRef.current.size,
      newWords: lesson.newWordIds.length,
      recallRate,
    });
    setLessonProgress(lesson.id, "complete");
    router.push("/");
  }

  const toReview = Array.from(touchedRef.current)
    .map((id) => state.words[id])
    .filter((w) => w && w.familiarity < 0.5);

  const recallItem = lesson.recall[recallIndex];
  const practiceItem = lesson.practice[practiceIndex];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {lesson.emoji} {lesson.title}
          </h1>
          <p className="mt-1 text-slate-500">
            Langkah {STEP_ORDER[step]} dari 6 · {STEP_LABELS[step]}
          </p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-5 rounded-full ${
                n <= STEP_ORDER[step] ? "bg-brand-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </header>

      {step === "warmup" && (
        <div className="space-y-4">
          {warmUp.length === 0 ? (
            <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-8 text-center text-white shadow-sm">
              <h2 className="text-2xl font-bold">Halo, siap belajar? 👋</h2>
              <p className="mt-2 text-brand-50">
                Hari ini kita mulai pelajaran {lesson.title}.
              </p>
              <button
                onClick={() => setStep("newwords")}
                className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
              >
                Let&apos;s begin!
              </button>
            </section>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Pemanasan — apa yang kamu ingat?
                </h2>
                <div className="mt-4 space-y-3">
                  {warmUp.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
                    >
                      <div>
                        <span className="text-lg font-semibold text-slate-900">
                          {w.indonesian}
                        </span>
                        <span className="ml-2 text-sm text-slate-400">{w.english}</span>
                      </div>
                      <SpeakButton text={w.indonesian} />
                    </div>
                  ))}
                </div>
              </section>
              <button
                onClick={() => setStep("newwords")}
                className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
              >
                Mulai
              </button>
            </>
          )}
        </div>
      )}

      {step === "newwords" && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Kata baru hari ini
            </h2>
            <div className="mt-4 space-y-4">
              {newWords.map((w) => (
                <div
                  key={w.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">{w.indonesian}</div>
                      {state.profile.pronunciationOn && (
                        <div className="text-sm text-slate-400">{w.pronunciation}</div>
                      )}
                    </div>
                    <SpeakButton text={w.indonesian} />
                  </div>
                  <div className="mt-1 text-slate-600">{w.english}</div>
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    {w.example} <span className="text-slate-400">— {w.exampleTranslation}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <button
            onClick={() => setStep("conversation")}
            className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Lanjut
          </button>
        </div>
      )}

      {step === "conversation" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Dengarkan Kak berbicara
          </h2>
          <div className="mt-4 space-y-3">
            <ChatBubble kind="tutor">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  Halo! Selamat datang di pelajaran {lesson.emoji} {lesson.title}. Dengarkan ya.
                </div>
                <SpeakButton
                  text={`Halo! Selamat datang di pelajaran ${lesson.title}.`}
                />
              </div>
            </ChatBubble>
            {lesson.sentences.map((s, i) => (
              <ChatBubble key={i} kind="tutor">
                <div className="flex items-start gap-2">
                  <div className="flex-1">{s}</div>
                  <SpeakButton text={s} />
                </div>
                {state.profile.translationMode === "beginner" &&
                  lesson.translations?.[i] && (
                    <div className="mt-1 text-xs text-slate-400">
                      {lesson.translations[i]}
                    </div>
                  )}
              </ChatBubble>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            💡 {lesson.grammarNote ?? lesson.reviewNote}
          </div>
          <button
            onClick={startPractice}
            className="mt-4 w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Sekarang saya coba
          </button>
        </section>
      )}

      {step === "practice" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Latihan {practiceIndex + 1} dari {lesson.practice.length}
            </h2>
            {practiceItem && <div className="text-xs text-slate-400">{practiceItem.hint}</div>}
          </div>
          <div className="mt-4 space-y-3">
            {practiceMessages.map((m) => (
              <ChatBubble key={m.id} kind={m.kind === "tutor" ? "tutor" : "learner"}>
                {m.content}
              </ChatBubble>
            ))}
          </div>
          {practiceFeedback && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                practiceFeedbackType === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : practiceFeedbackType === "warn"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-red-50 text-red-700"
              }`}
            >
              {practiceFeedback}
            </div>
          )}
          {practiceError && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {practiceError}
            </div>
          )}
          <form onSubmit={handlePracticeSubmit} className="mt-4 flex gap-2">
            <input
              value={practiceInput}
              onChange={(e) => setPracticeInput(e.target.value)}
              disabled={practiceBusy || practiceFeedbackType === "ok"}
              placeholder="Tulis dalam bahasa Indonesia…"
              autoComplete="off"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={practiceBusy || practiceFeedbackType === "ok" || practiceInput.trim() === ""}
              className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-50"
            >
              Kirim
            </button>
          </form>
        </section>
      )}

      {step === "recall" && recallItem && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Ingatan {recallIndex + 1} dari {lesson.recall.length}
          </h2>
          <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center">
            <div className="text-3xl font-bold text-slate-900">{recallItem.english}</div>
            <div className="mt-1 text-sm text-slate-400">Bagaimana bilangnya dalam bahasa Indonesia?</div>
          </div>
          {recallFeedback && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                recallFeedbackType === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {recallFeedback}
            </div>
          )}
          {recallRevealed ? (
            <button
              onClick={nextRecall}
              className="mt-4 w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
            >
              Lanjut
            </button>
          ) : (
            <form onSubmit={handleRecallSubmit} className="mt-4 flex gap-2">
              <input
                value={recallInput}
                onChange={(e) => setRecallInput(e.target.value)}
                placeholder="Ketik jawaban…"
                autoComplete="off"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={recallInput.trim() === ""}
                className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-50"
              >
                Periksa
              </button>
            </form>
          )}
        </section>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Kata baru</h2>
            <ul className="mt-3 space-y-1.5">
              {newWords.map((w) => (
                <li key={w.id} className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{w.indonesian}</span>
                  <span className="text-slate-400"> — </span>
                  {w.english}
                </li>
              ))}
            </ul>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section className="rounded-xl bg-slate-50 p-4">
              <div className="text-2xl font-bold text-slate-800">{mistakes}</div>
              <div className="mt-0.5 text-sm text-slate-500">Kesalahan</div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Yang perlu diulang</h2>
            {toReview.length === 0 ? (
              <p className="mt-3 text-slate-500">
                Tidak ada — kamu menguasainya! Bagus sekali. 🎉
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {toReview.map((w) => (
                  <span
                    key={w.id}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                  >
                    {w.indonesian} <span className="text-slate-400">—</span> {w.english}
                  </span>
                ))}
              </div>
            )}
          </section>

          <button
            onClick={finish}
            className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Selesai! 🎉
          </button>
        </div>
      )}
    </div>
  );
}
