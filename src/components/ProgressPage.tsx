"use client";

import { useStore } from "@/lib/store/useStore";
import { WORD_BANK } from "@/lib/data/words";
import { LESSONS } from "@/lib/data/lessons";
import { knownWordIds } from "@/lib/difficulty/learnerModel";
import { scheduler } from "@/lib/srs/scheduler";

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

function Bar({ value }: { value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function DotScale({ label, value }: { label: string; value: number }) {
  const filled = dotsFor(value);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < filled ? "bg-brand-500" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function ProgressPage() {
  const state = useStore((s) => s.state);

  const learnedIds = knownWordIds(state.words);
  const learnedCount = learnedIds.length;

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
        <h1 className="text-2xl font-bold text-slate-900">📈 Progress</h1>
        <p className="mt-1 text-slate-500">
          A look at how far you&apos;ve come — no guesswork, just what you&apos;ve
          done.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Vocabulary learned
          </h2>
          <span className="text-sm font-semibold text-slate-700">
            {learnedCount} of {WORD_BANK.length} words learned
          </span>
        </div>
        <Bar value={learnedCount / WORD_BANK.length} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Your level
        </h2>
        <div className="mt-3 text-xl font-bold text-slate-800">
          {levelLabel}
        </div>
        <div className="mt-5 space-y-3">
          <DotScale
            label="Conversation ability"
            value={state.profile.conversationAbility}
          />
          <DotScale label="Confidence" value={state.profile.confidence} />
          <DotScale
            label="Vocabulary knowledge"
            value={state.profile.vocabKnowledge}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Review strength
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-bold text-slate-800">
              {studied.length === 0 ? "—" : `${strength}%`}
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              average recall of words you&apos;ve met
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-bold text-slate-800">{dueCount}</div>
            <div className="mt-0.5 text-sm text-slate-500">
              words due today
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Recent sessions
        </h2>
        {recentSessions.length === 0 ? (
          <p className="mt-3 text-slate-500">
            No sessions yet — finish a lesson or review to see it here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {recentSessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-slate-800">
                  {new Date(s.ts).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-sm text-slate-500">
                  {s.durationMin} min
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {Math.round(s.recallRate * 100)}% recall
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Topics completed
        </h2>
        <div className="mt-4 space-y-4">
          {levelGroups.map((g) => (
            <div key={g.level}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-700">
                  Level {g.level + 1}
                </span>
                <span className="text-sm text-slate-500">
                  {g.completed} of {g.total} topics
                </span>
              </div>
              <Bar value={g.completed / g.total} />
            </div>
          ))}
        </div>
        <ul className="mt-6 divide-y divide-slate-100">
          {LESSONS.map((l) => {
            const done = state.lessons[l.id]?.status === "complete";
            return (
              <li
                key={l.id}
                className="flex items-center gap-3 py-3"
              >
                <span className="text-xl">{l.emoji}</span>
                <span
                  className={`flex-1 text-sm ${
                    done ? "text-slate-700" : "text-slate-500"
                  }`}
                >
                  {l.title}
                </span>
                <span
                  className={
                    done ? "text-emerald-500" : "text-slate-300"
                  }
                >
                  {done ? "✓" : "○"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
