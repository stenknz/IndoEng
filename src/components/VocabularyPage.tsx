"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { browserTTS } from "@/lib/audio/browserTTS";
import { WORD_BANK, categoryOrder } from "@/lib/data/words";
import type { VocabularyWord } from "@/lib/types";

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

function isLearned(w: VocabularyWord): boolean {
  return w.lastReviewed !== null;
}

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

function StatusBadge({ learned }: { learned: boolean }) {
  if (learned) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Learned
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
      New
    </span>
  );
}

const usedCategories = categoryOrder.filter((c) =>
  WORD_BANK.some((w) => w.category === c),
);

export function VocabularyPage() {
  const state = useStore((s) => s.state);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [learnedOnly, setLearnedOnly] = useState(false);

  const learnedCount = useMemo(
    () =>
      WORD_BANK.filter((w) => {
        const s = state.words[w.id];
        return s ? isLearned(s) : false;
      }).length,
    [state.words],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = WORD_BANK.map((w) => {
      const stored = state.words[w.id];
      return stored ? mergeStateWord(w, stored) : w;
    });
    return words.filter((w) => {
      if (category && w.category !== category) return false;
      if (learnedOnly && !isLearned(w)) return false;
      if (q) {
        const hay = `${w.indonesian} ${w.english}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.words, query, category, learnedOnly]);

  const percent = Math.round((learnedCount / WORD_BANK.length) * 100);

  const chipClass = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
      active
        ? "border-brand-600 bg-brand-600 text-white shadow-sm"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">📚 Vocabulary</h1>
        <p className="mt-1 text-slate-500">
          Every word you&apos;ll learn — search, filter, and hear them out loud.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Progress
          </h2>
          <span className="text-sm font-semibold text-slate-700">
            {learnedCount} of {WORD_BANK.length} words learned
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            🔎
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Indonesian or English…"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-brand-500"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          <input
            type="checkbox"
            checked={learnedOnly}
            onChange={(e) => setLearnedOnly(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-600"
          />
          Learned only
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={chipClass(category === null)}
        >
          All
        </button>
        {usedCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(category === c ? null : c)}
            className={chipClass(category === c)}
          >
            {c}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🔍</div>
          <h3 className="mt-3 text-lg font-bold text-slate-800">
            No words found
          </h3>
          <p className="mt-1 text-slate-500">
            Try a different search or clear your filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(null);
              setLearnedOnly(false);
            }}
            className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Clear filters
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((w) => {
            const learned = isLearned(w);
            return (
              <article
                key={w.id}
                className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${
                  learned ? "bg-white" : "bg-slate-50/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-bold text-slate-900">
                        {w.indonesian}
                      </h3>
                      <StatusBadge learned={learned} />
                    </div>
                    <div className="mt-0.5 text-sm text-slate-400">
                      {w.pronunciation}
                    </div>
                  </div>
                  <SpeakButton text={w.indonesian} />
                </div>
                <div className="mt-1 text-slate-600">{w.english}</div>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  {w.example} <span className="text-slate-400">— {w.exampleTranslation}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
