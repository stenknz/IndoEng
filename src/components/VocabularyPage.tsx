"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { WORD_BANK, categoryOrder } from "@/lib/data/words";
import { SpeakButton } from "@/components/SpeakButton";
import { WordImage } from "@/components/WordImage";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import type { VocabularyWord } from "@/lib/types";

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
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-canopy-50 px-2.5 py-0.5 text-xs font-semibold text-canopy-700">
        <span className="h-1.5 w-1.5 rounded-full bg-canopy-600" />
        Learned
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-marigold-50 px-2.5 py-0.5 text-xs font-semibold text-marigold-700">
      New
    </span>
  );
}

const usedCategories = categoryOrder.filter((c) =>
  WORD_BANK.some((w) => w.category === c),
);

export function VocabularyPage() {
  const state = useStore((s) => s.state);
  const pronunciationOn = useStore((s) => s.state.profile.pronunciationOn);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [learnedOnly, setLearnedOnly] = useState(false);
  const [sort, setSort] = useState<"freq" | "cat">("freq");

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
    return words
      .filter((w) => {
        if (category && w.category !== category) return false;
        if (learnedOnly && !isLearned(w)) return false;
        if (q) {
          const hay = `${w.indonesian} ${w.english}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        sort === "freq"
          ? (a.frequency ?? Number.MAX_SAFE_INTEGER) - (b.frequency ?? Number.MAX_SAFE_INTEGER)
          : categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
            a.indonesian.localeCompare(b.indonesian),
      );
  }, [state.words, query, category, learnedOnly, sort]);

  const chipClass = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
      active
        ? "border-canopy-600 bg-canopy-600 text-white shadow-card"
        : "border-ink/10 bg-white text-muted hover:bg-canopy-50"
    }`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Vocabulary
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every word you&apos;ll learn — search, filter, and hear them out loud.
        </p>
      </header>

      <section className="rounded-2xl border border-ink/5 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Progress
          </h2>
          <span className="text-sm font-semibold text-ink">
            {learnedCount} of {WORD_BANK.length} words learned
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={learnedCount / WORD_BANK.length} />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <Icon name="book" className="h-4 w-4" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Indonesian or English…"
            autoComplete="off"
            className="w-full rounded-xl border border-ink/10 bg-white py-3 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-canopy-50">
          <input
            type="checkbox"
            checked={learnedOnly}
            onChange={(e) => setLearnedOnly(e.target.checked)}
            className="h-4 w-4 rounded accent-canopy-600"
          />
          Learned only
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-ink/10 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setSort("freq")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              sort === "freq" ? "bg-canopy-600 text-white" : "text-muted hover:bg-canopy-50"
            }`}
          >
            Paling sering
          </button>
          <button
            type="button"
            onClick={() => setSort("cat")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              sort === "cat" ? "bg-canopy-600 text-white" : "text-muted hover:bg-canopy-50"
            }`}
          >
            Kategori
          </button>
        </div>
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
        <EmptyState
          icon="🔍"
          title="No words found"
          body="Try a different search or clear your filters."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setCategory(null);
                setLearnedOnly(false);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((w) => {
            const learned = isLearned(w);
            return (
              <article
                key={w.id}
                className={`rounded-2xl border border-ink/5 p-5 shadow-card transition ${
                  learned ? "bg-white" : "bg-mist/40"
                }`}
              >
                <div className="flex items-start gap-4">
                  {w.image && (
                    <div className="w-24 shrink-0">
                      <WordImage src={w.image} alt={w.english} aspect="square" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-2xl font-bold text-ink">
                            {w.indonesian}
                          </h3>
                          <StatusBadge learned={learned} />
                        </div>
                        {pronunciationOn && (
                          <div className="mt-0.5 text-sm text-muted">
                            {w.pronunciation}
                          </div>
                        )}
                      </div>
                      <SpeakButton text={w.indonesian} />
                    </div>
                    <div className="mt-1 text-sm text-ink">{w.english}</div>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-mist/70 px-3 py-2 text-sm text-muted">
                  {w.example}{" "}
                  <span className="text-muted/70">— {w.exampleTranslation}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
