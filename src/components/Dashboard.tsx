"use client";

import Link from "next/link";
import { useStore } from "@/lib/store/useStore";
import { LESSONS } from "@/lib/data/lessons";
import { WORD_BANK } from "@/lib/data/words";
import { scheduler } from "@/lib/srs/scheduler";
import { knownWordIds } from "@/lib/difficulty/learnerModel";
import { LevelBar } from "@/components/LevelBar";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="mt-0.5 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export function Dashboard() {
  const state = useStore((s) => s.state);

  const todaySessions = state.sessions.filter((s) => s.ts >= startOfToday());
  const minutes = todaySessions.reduce((sum, s) => sum + s.durationMin, 0);
  const wordsReviewed = todaySessions.reduce((sum, s) => sum + s.wordsReviewed, 0);
  const newWords = todaySessions.reduce((sum, s) => sum + s.newWords, 0);
  const recallRate =
    todaySessions.length === 0
      ? 0
      : Math.round(
          (todaySessions.reduce((sum, s) => sum + s.recallRate, 0) /
            todaySessions.length) *
            100,
        );

  const learned = knownWordIds(state.words).length;
  const firstRun = learned === 0;
  const progress = Math.min(1, learned / WORD_BANK.length);
  const level = state.profile.level;

  const continueLesson = LESSONS.find(
    (l) => state.lessons[l.id]?.status !== "complete",
  );
  const firstLesson = LESSONS[0];

  const dueWords = scheduler.dueItems(state.words).slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {!firstRun && (
            <h1 className="text-2xl font-bold text-slate-900">
              Halo, {state.user.name}! 👋
            </h1>
          )}
          <p className="text-slate-500">
            {firstRun
              ? "Belajar bahasa Indonesia, the natural way."
              : "Ready to keep learning a little today?"}
          </p>
        </div>
        <div className="w-44">
          <LevelBar level={level} progress={progress} />
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">Today's Learning</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Minutes" value={minutes} />
          <Stat label="Words reviewed" value={wordsReviewed} />
          <Stat label="New words" value={newWords} />
          <Stat label="Recall" value={`${recallRate}%`} />
        </div>
      </section>

      {firstRun ? (
        <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-8 text-white shadow-sm">
          <h2 className="text-2xl font-bold">Halo! Selamat datang 👋</h2>
          <p className="mt-2 max-w-md text-brand-50">
            Learn Indonesian the natural way — a few minutes every day, starting
            with your very first words.
          </p>
          <Link
            href={`/lesson/${firstLesson.id}`}
            className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
          >
            Start Lesson {firstLesson.order} →
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Continue Learning
          </h2>
          {continueLesson ? (
            <Link
              href={`/lesson/${continueLesson.id}`}
              className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4 transition hover:bg-slate-100"
            >
              <span className="flex items-center gap-3">
                <span className="text-3xl">{continueLesson.emoji}</span>
                <span>
                  <span className="block font-semibold text-slate-800">
                    {continueLesson.title}
                  </span>
                  <span className="block text-sm text-slate-500">
                    Lesson {continueLesson.order}
                  </span>
                </span>
              </span>
              <span className="font-semibold text-brand-600">Continue →</span>
            </Link>
          ) : (
            <p className="mt-3 text-slate-500">
              🎉 You've finished every lesson. Bagus sekali!
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">Words to Review</h2>
        {dueWords.length === 0 ? (
          <p className="mt-3 text-slate-500">
            All caught up! No words due for review right now.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {dueWords.map((w) => (
              <span
                key={w.id}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                {w.indonesian} <span className="text-slate-400">—</span>{" "}
                {w.english}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
