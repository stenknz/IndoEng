"use client";

import Link from "next/link";
import { useStore } from "@/lib/store/useStore";
import { LESSONS } from "@/lib/data/lessons";
import { WORD_BANK } from "@/lib/data/words";
import { scheduler } from "@/lib/srs/scheduler";
import { metWordIds } from "@/lib/difficulty/learnerModel";
import { LevelBar } from "@/components/LevelBar";
import { ProgressBar } from "@/components/ProgressBar";
import { Waveform } from "@/components/Waveform";
import { Card } from "@/components/Card";
import type { LearningSession } from "@/lib/types";

const DAILY_GOAL_MIN = 5;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function computeStreak(sessions: LearningSession[]): number {
  const days = new Set(sessions.map((s) => dayKey(s.ts)));
  const cursor = new Date();
  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Selamat malam";
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-mist/70 p-4">
      <div className="font-display text-2xl font-bold text-canopy-700">
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
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

  const learned = metWordIds(state.words).length;
  const firstRun = learned === 0;
  const progress = Math.min(1, learned / WORD_BANK.length);
  const level = state.profile.level;
  const streak = computeStreak(state.sessions);
  const goalProgress = Math.min(1, minutes / DAILY_GOAL_MIN);

  const continueLesson = LESSONS.find(
    (l) => state.lessons[l.id]?.status !== "complete",
  );
  const firstLesson = LESSONS[0];

  const dueWords = scheduler.dueItems(state.words).slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {!firstRun && (
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              {greeting()}, {state.user.name}!
            </h1>
          )}
          <p className="mt-1 text-sm text-muted">
            {firstRun
              ? "Belajar bahasa Indonesia, the natural way."
              : "Ready to keep learning a little today?"}
          </p>
        </div>
        <div className="w-44">
          <LevelBar level={level} progress={progress} />
        </div>
      </header>

      {firstRun ? (
        <Card className="relative overflow-hidden bg-canopy-600 p-8 text-white">
          <div className="absolute right-6 top-6 opacity-20">
            <Waveform light className="scale-150" />
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Halo! Selamat datang
          </h2>
          <p className="mt-2 max-w-md text-sm text-canopy-100">
            Learn Indonesian the natural way — a few minutes every day,
            starting with your very first words.
          </p>
          <Link
            href={`/lesson/${firstLesson.id}`}
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-canopy-700 shadow-card transition hover:bg-mist active:scale-[0.98]"
          >
            Start Lesson {firstLesson.order} →
          </Link>
        </Card>
      ) : (
        <Card hover className="p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Continue Learning
          </h2>
          {continueLesson ? (
            <Link
              href={`/lesson/${continueLesson.id}`}
              className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-mist/60 p-4 transition hover:bg-canopy-50"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-card">
                  {continueLesson.emoji}
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold text-ink">
                    {continueLesson.title}
                  </span>
                  <span className="block text-sm text-muted">
                    Lesson {continueLesson.order}
                  </span>
                </span>
              </span>
              <span className="font-semibold text-canopy-600">Continue →</span>
            </Link>
          ) : (
            <p className="mt-3 text-muted">
              🎉 You've finished every lesson. Bagus sekali!
            </p>
          )}
        </Card>
      )}

      {!firstRun && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
                Streak
              </h2>
              <span className="text-xl">🔥</span>
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-canopy-700">
              {streak} {streak === 1 ? "day" : "days"}
            </div>
            <p className="mt-1 text-xs text-muted">
              {streak > 0
                ? "Keep it up — one small lesson a day."
                : "Learn once today to start your streak."}
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
                Today's goal
              </h2>
              <span className="font-display text-lg font-semibold text-marigold-700">
                {minutes} / {DAILY_GOAL_MIN} min
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar value={goalProgress} tone="marigold" />
            </div>
            <p className="mt-2 text-xs text-muted">
              {minutes >= DAILY_GOAL_MIN
                ? "Goal reached — bagus sekali! 🎉"
                : "A little bit each day adds up."}
            </p>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Today's Learning</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Minutes" value={minutes} />
          <Stat label="Words reviewed" value={wordsReviewed} />
          <Stat label="New words" value={newWords} />
          <Stat label="Recall" value={`${recallRate}%`} />
        </div>
      </Card>

      <Card hover className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Ngobrol dengan Kak
            </h2>
            <p className="mt-1 text-sm text-muted">
              {state.profile.aiTutorOn
                ? "Pelan-pelan dan sabar — Kak menjawab apa saja."
                : "Pakai kata-kata yang sudah kamu tahu dalam percakapan."}
            </p>
          </div>
          <Link
            href="/conversation"
            className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-canopy-50 active:scale-[0.98]"
          >
            Ngobrol →
          </Link>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Words to Review</h2>
        {dueWords.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            All caught up! No words due for review right now.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {dueWords.map((w) => (
              <span
                key={w.id}
                className="rounded-full border border-ink/5 bg-mist/70 px-3 py-1.5 text-sm font-medium text-ink"
              >
                {w.indonesian} <span className="text-muted">—</span>{" "}
                {w.english}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
