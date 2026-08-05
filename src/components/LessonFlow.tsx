"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store/useStore";
import { TutorEngine } from "@/lib/engine/engine";
import { matchAnswer } from "@/lib/engine/matcher";
import { WORD_BANK } from "@/lib/data/words";
import { SpeakButton } from "@/components/SpeakButton";
import { Waveform } from "@/components/Waveform";
import { WordImage } from "@/components/WordImage";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Celebration } from "@/components/Celebration";
import { useToastStore } from "@/lib/toast";
import type {
  ConversationMessage,
  Lesson,
  PracticeAttempt,
  RecallItem,
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
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-card ${
          tutor
            ? "rounded-bl-sm border border-ink/5 bg-white text-ink"
            : "rounded-br-sm bg-canopy-600 text-white"
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
  const pushToast = useToastStore((s) => s.push);

  const engineRef = useRef<TutorEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TutorEngine();
  const engine = engineRef.current;

  const startedAt = useRef(Date.now());
  const touchedRef = useRef<Set<string>>(new Set());
  const finishingRef = useRef(false);
  const recallQueueRef = useRef<RecallItem[]>(lesson.recall);
  const recallRecycledRef = useRef<Set<string>>(new Set());

  const [step, setStep] = useState<Step>("warmup");
  const [mistakes, setMistakes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [warmupRevealed, setWarmupRevealed] = useState<Set<string>>(new Set());
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

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

  function toggleWarmupReveal(id: string) {
    setWarmupRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    const item = recallQueueRef.current[recallIndex];
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
        if (idx + 1 < recallQueueRef.current.length) {
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
      const fails = recallFails + 1;
      // Within-session recycling: re-queue the missed word once so it is
      // re-tested again before the lesson ends (error-driven restudy).
      if (fails === 1 && !recallRecycledRef.current.has(item.indonesian)) {
        recallRecycledRef.current.add(item.indonesian);
        recallQueueRef.current = [...recallQueueRef.current, item];
      }
      setRecallFeedbackType("warn");
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
    if (recallIndex + 1 < recallQueueRef.current.length) {
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
    setCelebrating(true);
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
    pushToast("Pelajaran selesai. Bagus sekali! 🎉");
    setTimeout(() => {
      router.push("/");
    }, 1200);
  }

  const toReview = Array.from(touchedRef.current)
    .map((id) => state.words[id])
    .filter((w) => w && w.familiarity < 0.5);

  const recallItem = lesson.recall[recallIndex];
  const practiceItem = lesson.practice[practiceIndex];
  const stepNumber = STEP_ORDER[step];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            {lesson.emoji} {lesson.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Langkah {stepNumber} dari 6 · {STEP_LABELS[step]}
          </p>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-5 rounded-full transition-colors duration-500 ${
                n <= stepNumber ? "bg-canopy-600" : "bg-mist"
              }`}
            />
          ))}
        </div>
      </header>

      {step === "warmup" && (
        <div className="space-y-4">
          {warmUp.length === 0 ? (
            <Card className="relative overflow-hidden bg-canopy-600 p-8 text-center text-white">
              <div className="absolute left-6 top-6 opacity-20">
                <Waveform light className="scale-150" />
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                Halo, siap belajar? 👋
              </h2>
              <p className="mt-2 text-sm text-canopy-100">
                Hari ini kita mulai pelajaran {lesson.title}.
              </p>
              <div className="mt-6 flex justify-center">
                <Button variant="inverse" onClick={() => setStep("newwords")}>
                  Let&apos;s begin!
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Pemanasan — coba ingat dulu, lalu ketuk untuk cek.
                </h2>
                <div className="mt-4 space-y-3">
                  {warmUp.map((w) => {
                    const revealed = warmupRevealed.has(w.id);
                    return (
                      <div
                        key={w.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-ink/5 bg-white px-5 py-4 shadow-card"
                      >
                        <button
                          type="button"
                          onClick={() => toggleWarmupReveal(w.id)}
                          aria-expanded={revealed}
                          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canopy-600/40 rounded-lg"
                        >
                          <span className="font-display text-lg font-semibold text-ink">
                            {w.indonesian}
                          </span>
                          <span className="ml-2 text-sm text-muted">
                            {revealed ? w.english : "(ketuk untuk ingat)"}
                          </span>
                        </button>
                        <SpeakButton text={w.indonesian} />
                      </div>
                    );
                  })}
                </div>
              </Card>
              <Button onClick={() => setStep("newwords")} className="w-full">
                Mulai
              </Button>
            </>
          )}
        </div>
      )}

      {step === "newwords" && (
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
              Kata baru hari ini
            </h2>
            <div className="mt-4 space-y-4">
              {newWords.map((w) => (
                <div
                  key={w.id}
                  className="rounded-2xl border border-ink/5 bg-white p-5 shadow-card"
                >
                  {w.image && (
                    <WordImage
                      src={w.image}
                      alt={w.english}
                      aspect="video"
                      className="mb-4"
                    />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {!w.image && (
                        <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-canopy-50 text-lg">
                          {wordById(w.id)?.category === "numbers" ? "🔢" : "🗣️"}
                        </span>
                      )}
                      <div>
                        <div className="font-display text-2xl font-bold text-ink">
                          {w.indonesian}
                        </div>
                        {state.profile.pronunciationOn && (
                          <div className="text-sm text-muted">{w.pronunciation}</div>
                        )}
                      </div>
                    </div>
                    <SpeakButton text={w.indonesian} />
                  </div>
                  <div className="mt-1 text-sm text-ink">{w.english}</div>
                  <div className="mt-3 rounded-xl bg-mist/70 px-3 py-2 text-sm text-muted">
                    {w.example}{" "}
                    <span className="text-muted/70">— {w.exampleTranslation}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Button onClick={() => setStep("conversation")} className="w-full">
            Lanjut
          </Button>
        </div>
      )}

      {step === "conversation" && (
        <Card className="p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Dengarkan Kak berbicara
          </h2>
          <div className="mt-4 space-y-3">
            <ChatBubble kind="tutor">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  Halo! Selamat datang di pelajaran {lesson.emoji} {lesson.title}.
                  Dengarkan ya.
                </div>
                <SpeakButton
                  text={`Halo! Selamat datang di pelajaran ${lesson.title}.`}
                />
              </div>
            </ChatBubble>
            {lesson.sentences.map((s, i) => (
              <ChatBubble key={i} kind="tutor">
                <div className="flex items-start gap-2">
                  <div className="mt-1.5">
                    <Waveform className="opacity-70" />
                  </div>
                  <div className="flex-1">{s}</div>
                  <SpeakButton text={s} />
                </div>
                {state.profile.translationMode === "beginner" &&
                  lesson.translations?.[i] && (
                    <div className="mt-1 text-xs text-muted">
                      {lesson.translations[i]}
                    </div>
                  )}
              </ChatBubble>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-marigold-50 px-4 py-3 text-sm text-marigold-700">
            💡 {lesson.grammarNote ?? lesson.reviewNote}
          </div>
          <Button onClick={startPractice} className="mt-4 w-full">
            Sekarang saya coba
          </Button>
        </Card>
      )}

      {step === "practice" && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
              Latihan {practiceIndex + 1} dari {lesson.practice.length}
            </h2>
            {practiceItem && (
              <div className="text-xs text-muted">{practiceItem.hint}</div>
            )}
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
              className={`mt-4 animate-pop rounded-xl px-4 py-3 text-sm ${
                practiceFeedbackType === "ok"
                  ? "bg-canopy-50 text-canopy-700"
                  : practiceFeedbackType === "warn"
                    ? "bg-marigold-50 text-marigold-700"
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
              className="flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15 disabled:bg-mist/60"
            />
            <Button
              type="submit"
              disabled={practiceBusy || practiceFeedbackType === "ok" || practiceInput.trim() === ""}
            >
              Kirim
            </Button>
          </form>
        </Card>
      )}

      {step === "recall" && recallItem && (
        <Card className="p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Ingatan {recallIndex + 1} dari {recallQueueRef.current.length}
          </h2>
          <div className="mt-4 rounded-2xl bg-mist/70 p-6 text-center">
            {(() => {
              const recallWord = WORD_BANK.find(
                (w) =>
                  w.indonesian.toLowerCase() === recallItem.indonesian.toLowerCase(),
              );
              return recallWord?.image ? (
                <div className="mx-auto mb-4 w-44">
                  <WordImage
                    src={recallWord.image}
                    alt={recallWord.english}
                    aspect="square"
                  />
                </div>
              ) : null;
            })()}
            <div className="font-display text-3xl font-bold text-ink">
              {recallItem.english}
            </div>
            <div className="mt-1 text-sm text-muted">
              Bagaimana bilangnya dalam bahasa Indonesia?
            </div>
          </div>
          {recallFeedback && (
            <div
              className={`mt-4 animate-pop rounded-xl px-4 py-3 text-sm ${
                recallFeedbackType === "ok"
                  ? "bg-canopy-50 text-canopy-700"
                  : "bg-marigold-50 text-marigold-700"
              }`}
            >
              {recallFeedback}
            </div>
          )}
          {recallRevealed ? (
            <Button onClick={nextRecall} className="mt-4 w-full">
              Lanjut
            </Button>
          ) : (
            <form onSubmit={handleRecallSubmit} className="mt-4 flex gap-2">
              <input
                value={recallInput}
                onChange={(e) => setRecallInput(e.target.value)}
                placeholder="Ketik jawaban…"
                autoComplete="off"
                className="flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15"
              />
              <Button type="submit" disabled={recallInput.trim() === ""}>
                Periksa
              </Button>
            </form>
          )}
        </Card>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-ink">Kata baru</h2>
            <ul className="mt-3 space-y-1.5">
              {newWords.map((w) => (
                <li key={w.id} className="text-sm text-ink">
                  <span className="font-semibold text-ink">{w.indonesian}</span>
                  <span className="text-muted"> — </span>
                  {w.english}
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-ink/5 bg-white p-4 shadow-card">
              <div className="font-display text-2xl font-bold text-canopy-700">
                {mistakes}
              </div>
              <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
                Kesalahan
              </div>
            </div>
            <div className="rounded-2xl border border-ink/5 bg-white p-4 shadow-card">
              <div className="font-display text-2xl font-bold text-marigold-700">
                {correctCount}
              </div>
              <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
                Benar
              </div>
            </div>
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-ink">Yang perlu diulang</h2>
            {toReview.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Tidak ada — kamu menguasainya! Bagus sekali. 🎉
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {toReview.map((w) => (
                  <span
                    key={w.id}
                    className="rounded-full border border-ink/5 bg-mist/70 px-3 py-1.5 text-sm font-medium text-ink"
                  >
                    {w.indonesian} <span className="text-muted">—</span> {w.english}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Button onClick={finish} className="w-full">
            Selesai! 🎉
          </Button>
        </div>
      )}

      {celebrating && <Celebration label="Pelajaran selesai!" />}
    </div>
  );
}
