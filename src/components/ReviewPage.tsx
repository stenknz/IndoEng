"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { scheduler } from "@/lib/srs/scheduler";
import { matchAnswer } from "@/lib/engine/matcher";
import { browserTTS } from "@/lib/audio/browserTTS";
import { WORD_BANK } from "@/lib/data/words";
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-center">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="mt-0.5 text-sm text-slate-500">{label}</div>
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
    return <div className="py-16 text-center text-slate-400">Memuat…</div>;
  }

  if (queue.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">🔄 Review</h1>
          <p className="mt-1 text-slate-500">
            Ingat kembali kata-kata yang sudah kamu pelajari.
          </p>
        </header>
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="text-4xl">🌴</div>
          <h2 className="mt-3 text-lg font-bold text-slate-800">
            Tidak ada yang perlu diulang hari ini!
          </h2>
          <p className="mt-1 text-slate-500">
            Semua kata sudah kamu kuasai. Bagus sekali! 🎉
          </p>
          <Link
            href="/conversation"
            className="mt-5 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Mari ngobrol dengan Kak →
          </Link>
        </section>
      </div>
    );
  }

  if (done) {
    const recallRate = Math.round((correctCount / queue.length) * 100);
    return (
      <div className="space-y-6">
        <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-8 text-center text-white shadow-sm">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-3 text-2xl font-bold">Selesai!</h2>
          <p className="mt-1 text-brand-50">
            Review selesai. Kata-kata ini akan muncul lagi saat waktunya tiba.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Ringkasan
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Benar" value={correctCount} />
            <Stat label="Diulang" value={queue.length} />
            <Stat label="Tingkat ingatan" value={`${recallRate}%`} />
          </div>
          <div className="mt-4 rounded-xl bg-brand-50 p-4 text-center">
            <div className="text-2xl font-bold text-brand-700">
              {maxStreak} 🔥
            </div>
            <div className="mt-0.5 text-sm text-brand-600">
              Jawaban benar beruntun terbaik
            </div>
          </div>
        </section>
        <Link
          href="/"
          className="block w-full rounded-xl bg-brand-600 px-6 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-brand-500"
        >
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  const word = queue[index];
  const progress = ((index + 1) / queue.length) * 100;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">🔄 Review</h1>
        <p className="mt-1 text-slate-500">
          Ingat kembali kata-kata yang sudah kamu pelajari.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Review
          </h2>
          <span className="text-sm font-semibold text-slate-500">
            {index + 1} / {queue.length}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-6 text-center">
          <div className="text-3xl font-bold text-slate-900">{word.english}</div>
          <SpeakButton text={word.indonesian} />
        </div>
        <p className="mt-2 text-center text-sm text-slate-400">
          Bagaimana bilangnya dalam bahasa Indonesia?
        </p>

        {feedback && (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              feedback.type === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {revealed ? (
          <button
            type="button"
            onClick={nextWord}
            className="mt-4 w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Lanjut
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik dalam bahasa Indonesia…"
              autoComplete="off"
              autoFocus
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={input.trim() === ""}
              className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-50"
            >
              Periksa
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
