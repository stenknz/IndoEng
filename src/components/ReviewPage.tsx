"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { scheduler } from "@/lib/srs/scheduler";
import { matchAnswer } from "@/lib/engine/matcher";
import { WORD_BANK } from "@/lib/data/words";
import { SpeakButton } from "@/components/SpeakButton";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import type { VocabularyWord } from "@/lib/types";

function mergeStateWord(bank: VocabularyWord, stored: VocabularyWord): VocabularyWord {
  return {
    ...bank,
    familiarity: stored.familiarity,
    exposures: stored.exposures,
    correct: stored.correct,
    mistakes: stored.mistakes,
    lastReviewed: stored.lastReviewed,
    nextReview: stored.nextReview,
    streak: stored.streak,
  };
}

function overlayFromBank(stored: VocabularyWord): VocabularyWord {
  const bank = WORD_BANK.find((w) => w.id === stored.id);
  return bank ? mergeStateWord(bank, stored) : stored;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-mist/70 p-4 text-center">
      <div className="font-display text-2xl font-bold text-canopy-700">{value}</div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}

export function ReviewPage() {
  const hydrated = useStore((s) => s.hydrated);
  const words = useStore((s) => s.state.words);
  const bumpWord = useStore((s) => s.bumpWord);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const addSession = useStore((s) => s.addSession);

  const startedAt = useRef(Date.now());
  const sessionRecorded = useRef(false);

  const [queue, setQueue] = useState<VocabularyWord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "warn"; text: string } | null>(
    null,
  );
  const [fails, setFails] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!hydrated || queue !== null) return;
    setQueue(scheduler.dueItems(words).map(overlayFromBank));
  }, [hydrated, words, queue]);

  useEffect(() => {
    if (!done || sessionRecorded.current) return;
    sessionRecorded.current = true;
    const durationMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    addSession({
      id: crypto.randomUUID(),
      ts: Date.now(),
      durationMin,
      wordsReviewed: queue?.length ?? 0,
      newWords: 0,
      recallRate: !queue || queue.length === 0 ? 1 : correctCount / queue.length,
    });
  }, [done, correctCount, queue, addSession]);

  function nextWord() {
    setFeedback(null);
    setRevealed(false);
    setFails(0);
    if (index + 1 < (queue?.length ?? 0)) {
      setIndex(index + 1);
    } else {
      setDone(true);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || revealed || !queue) return;
    if (feedback?.type === "ok") return;
    const word = queue[index];
    const result = matchAnswer(raw, [word.indonesian]);
    const wordResult =
      result.correct === true ? "correct" : result.correct === "partial" ? "partial" : "wrong";
    bumpWord(word.id, wordResult);
    recordAttempt({
      id: crypto.randomUUID(),
      ts: Date.now(),
      kind: "recall",
      prompt: word.english,
      learnerAnswer: raw,
      expected: word.indonesian,
      correct: result.correct,
      wordIds: [word.id],
    });
    setInput("");
    if (result.correct === true) {
      setCorrectCount((c) => c + 1);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setMaxStreak((m) => Math.max(m, nextStreak));
      setFeedback({
        type: "ok",
        text: `Bagus! 🙂 ${word.indonesian} = ${word.english}`,
      });
      const idx = index;
      setTimeout(() => {
        setFeedback(null);
        setRevealed(false);
        setFails(0);
        if (idx + 1 < (queue?.length ?? 0)) {
          setIndex(idx + 1);
        } else {
          setDone(true);
        }
      }, 900);
    } else {
      setStreak(0);
      const nextFails = fails + 1;
      setFails(nextFails);
      if (nextFails >= 2) {
        setRevealed(true);
        setFeedback({
          type: "warn",
          text: `Ingat: ${word.indonesian} = ${word.english}. Sekarang kamu sudah tahu!`,
        });
      } else if (result.correct === "partial") {
        setFeedback({
          type: "warn",
          text: `Hampir! — ${word.indonesian}. Coba lagi?`,
        });
      } else {
        setFeedback({
          type: "warn",
          text: `Ingat: ${word.indonesian} = ${word.english}. Coba lagi?`,
        });
      }
    }
  }

  if (queue === null) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Review
          </h1>
          <Skeleton className="mt-2 h-4 w-72" />
        </header>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Review
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ingat kembali kata-kata yang sudah kamu pelajari.
          </p>
        </header>
        <EmptyState
          icon="🌴"
          title="Tidak ada yang perlu diulang hari ini!"
          body="Semua kata sudah kamu kuasai. Bagus sekali! 🎉"
          action={
            <Link href="/conversation">
              <Button>Mari ngobrol dengan Kak →</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (done) {
    const recallRate = Math.round((correctCount / queue.length) * 100);
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden bg-canopy-600 p-8 text-center text-white">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Selesai!
          </h2>
          <p className="mt-1 text-sm text-canopy-100">
            Review selesai. Kata-kata ini akan muncul lagi saat waktunya tiba.
          </p>
        </Card>
        <Card className="p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Ringkasan
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Benar" value={correctCount} />
            <Stat label="Diulang" value={queue.length} />
            <Stat label="Tingkat ingatan" value={`${recallRate}%`} />
          </div>
          <div className="mt-4 rounded-xl bg-marigold-50 p-4 text-center">
            <div className="font-display text-2xl font-bold text-marigold-700">
              {maxStreak} 🔥
            </div>
            <div className="mt-0.5 text-sm text-muted">
              Jawaban benar beruntun terbaik
            </div>
          </div>
        </Card>
        <Link href="/" className="block">
          <Button className="w-full">Kembali ke beranda</Button>
        </Link>
      </div>
    );
  }

  const word = queue[index];
  const progress = ((index + 1) / queue.length) * 100;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Review
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ingat kembali kata-kata yang sudah kamu pelajari.
        </p>
      </header>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Review
          </h2>
          <span className="text-sm font-semibold text-muted">
            {index + 1} / {queue.length}
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={progress} />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-mist/70 p-6 text-center">
          <div className="font-display text-3xl font-bold text-ink">
            {word.english}
          </div>
          <SpeakButton text={word.indonesian} />
        </div>
        <p className="mt-2 text-center text-sm text-muted">
          Bagaimana bilangnya dalam bahasa Indonesia?
        </p>

        {feedback && (
          <div
            className={`mt-4 animate-pop rounded-xl px-4 py-3 text-sm ${
              feedback.type === "ok"
                ? "bg-canopy-50 text-canopy-700"
                : "bg-marigold-50 text-marigold-700"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {revealed ? (
          <Button onClick={nextWord} className="mt-4 w-full">
            Lanjut
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik dalam bahasa Indonesia…"
              autoComplete="off"
              autoFocus
              className="flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15"
            />
            <Button type="submit" disabled={input.trim() === ""}>
              Periksa
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
