"use client";

import { useStore } from "@/lib/store/useStore";
import { WORD_BANK } from "@/lib/data/words";
import { LESSONS } from "@/lib/data/lessons";
import { metWordIds } from "@/lib/difficulty/learnerModel";
import { scheduler } from "@/lib/srs/scheduler";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";

const LEVEL_LABELS = [
  "Level 1 — Survival Words",
  "Level 2 — Tiny Sentences",
  "Level 3 — Everyday Conversation",
  "Level 4 — Natural Conversation",
  "Level 5 — Advanced",
];

function dotsFor(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value * 5)));
}

function DotScale({ label, value }: { label: string; value: number }) {
  const filled = dotsFor(value);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
              i < filled ? "bg-canopy-600" : "bg-mist"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function ProgressPage() {
  const state = useStore((s) => s.state);

  const learnedIds = metWordIds(state.words);
  const learnedCount = learnedIds.length;

  const recentAttempts = state.attempts.slice(-10);
  const recentCorrect = recentAttempts.filter((a) => a.correct === true).length;
  const recentAccuracy =
    recentAttempts.length === 0
      ? 0.5
      : recentCorrect / recentAttempts.length;
  const vocabKnowledge = learnedCount / WORD_BANK.length;

  const studied = Object.values(state.words);
  const avgFamiliarity =
    studied.length === 0
      ? 0
      : studied.reduce((sum, w) => sum + w.familiarity, 0) / studied.length;
  const strength = Math.round(avgFamiliarity * 100);
  const dueCount = scheduler.dueItems(state.words).length;

  const levelLabel =
    LEVEL_LABELS[state.profile.level] ?? LEVEL_LABELS[0];

  const recentSessions = [...state.sessions]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  const levels = Array.from(new Set(LESSONS.map((l) => l.level))).sort(
    (a, b) => a - b,
  );
  const levelGroups = levels.map((level) => {
    const lessons = LESSONS.filter((l) => l.level === level);
    const completed = lessons.filter(
      (l) => state.lessons[l.id]?.status === "complete",
    ).length;
    return { level, total: lessons.length, completed };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Progress
        </h1>
        <p className="mt-1 text-sm text-muted">
          A look at how far you&apos;ve come — no guesswork, just what you&apos;ve
          done.
        </p>
      </header>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Vocabulary learned
          </h2>
          <span className="text-sm font-semibold text-ink">
            {learnedCount} of {WORD_BANK.length} words learned
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={learnedCount / WORD_BANK.length} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Your level
        </h2>
        <div className="mt-3 font-display text-2xl font-bold text-canopy-700">
          {levelLabel}
        </div>
        <div className="mt-5 space-y-3">
          <DotScale label="Conversation ability" value={recentAccuracy} />
          <DotScale label="Confidence" value={recentAccuracy} />
          <DotScale label="Vocabulary knowledge" value={vocabKnowledge} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Review strength
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-mist/70 p-4">
            <div className="font-display text-2xl font-bold text-canopy-700">
              {studied.length === 0 ? "—" : `${strength}%`}
            </div>
            <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
              average recall of words you&apos;ve met
            </div>
          </div>
          <div className="rounded-xl bg-mist/70 p-4">
            <div className="font-display text-2xl font-bold text-marigold-700">
              {dueCount}
            </div>
            <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
              words due today
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Recent sessions
        </h2>
        {recentSessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No sessions yet — finish a lesson or review to see it here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/5">
            {recentSessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-ink">
                  {new Date(s.ts).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-sm text-muted">{s.durationMin} min</span>
                <span className="text-sm font-semibold text-ink">
                  {Math.round(s.recallRate * 100)}% recall
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Topics completed
        </h2>
        <div className="mt-4 space-y-4">
          {levelGroups.map((g) => (
            <div key={g.level}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-ink">
                  Level {g.level + 1}
                </span>
                <span className="text-sm text-muted">
                  {g.completed} of {g.total} topics
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar value={g.completed / g.total} />
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-6 divide-y divide-ink/5">
          {LESSONS.map((l) => {
            const done = state.lessons[l.id]?.status === "complete";
            return (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mist/70 text-lg">
                  {l.emoji}
                </span>
                <span
                  className={`flex-1 text-sm ${
                    done ? "text-ink" : "text-muted"
                  }`}
                >
                  {l.title}
                </span>
                <span
                  className={
                    done ? "font-semibold text-canopy-600" : "text-muted/50"
                  }
                >
                  {done ? "✓" : "○"}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
