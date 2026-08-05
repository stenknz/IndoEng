"use client";

import { useMemo, useState } from "react";
import { searchDictionary, type DictionaryEntry } from "@/lib/data/dictionary";
import { SpeakButton } from "@/components/SpeakButton";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-canopy-50 px-2.5 py-0.5 text-xs font-medium text-canopy-700">
      {children}
    </span>
  );
}

function Chip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-ink/10 bg-white px-2.5 py-0.5 text-xs text-muted transition hover:border-canopy-600 hover:text-canopy-700"
    >
      {children}
    </button>
  );
}

function ResultCard({
  entry,
  onRelated,
}: {
  entry: DictionaryEntry;
  onRelated: (term: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-ink/5 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold text-ink">
              {entry.indonesian}
            </h2>
            {entry.wordClass && <Badge>{entry.wordClass}</Badge>}
          </div>
          <div className="mt-0.5 text-sm text-muted">
            {entry.pronunciation}
            {entry.formal || entry.casual ? (
              <span className="ml-2 text-muted/70">
                {entry.formal && `formal: ${entry.formal}`}
                {entry.formal && entry.casual && " · "}
                {entry.casual && `casual: ${entry.casual}`}
              </span>
            ) : null}
          </div>
        </div>
        <SpeakButton text={entry.indonesian} />
      </div>

      <p className="mt-2 text-lg text-ink">
        {entry.english}
        {entry.alternatives && entry.alternatives.length > 0 && (
          <span className="ml-2 text-sm text-muted">
            ({entry.alternatives.join(", ")})
          </span>
        )}
      </p>

      {entry.expression && (
        <p className="mt-2 rounded-xl bg-marigold-50 px-3 py-2 text-sm text-marigold-700">
          💡 {entry.expression}
        </p>
      )}

      {(entry.example || entry.note) && (
        <div className="mt-3 rounded-xl bg-mist/70 px-3 py-2 text-sm text-muted">
          {entry.example && (
            <div>
              <span className="text-ink">{entry.example}</span>
              {entry.exampleEn && <div>{entry.exampleEn}</div>}
            </div>
          )}
          {entry.note && (
            <div className={entry.example ? "mt-1.5 border-t border-ink/10 pt-1.5" : ""}>
              {entry.note}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.synonyms?.map((s) => (
          <Chip key={`syn-${s}`} onClick={() => onRelated(s)}>
            {s}
          </Chip>
        ))}
        {entry.antonyms?.map((a) => (
          <Chip key={`ant-${a}`} onClick={() => onRelated(a)}>
            bukan: {a}
          </Chip>
        ))}
        {entry.related?.map((r) => (
          <Chip key={`rel-${r}`} onClick={() => onRelated(r)}>
            {r}
          </Chip>
        ))}
      </div>
    </article>
  );
}

export function QuickTranslatePage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchDictionary(query), [query]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Translate cepat
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cari kata atau kalimat — English ↔ Indonesian, instan.
        </p>
      </header>

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          <Icon name="sparkles" className="h-4 w-4" />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a word or phrase — e.g. nasi, thank you, apa kabar…"
          autoComplete="off"
          autoFocus
          aria-label="Search translation"
          className="w-full rounded-2xl border border-ink/10 bg-white py-3.5 pl-10 pr-4 text-sm text-ink shadow-card outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15"
        />
      </div>

      {query.trim() === "" ? (
        <EmptyState
          icon="🔍"
          title="Cari kata apa saja"
          body="Mulai mengetik — kami cari di kamus kecilmu. Coba 'nasi', 'apa kabar', atau 'thank you'."
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon="🌴"
          title="Belum ada di kamus"
          body={`Kata "${query.trim()}" belum ada di kamus Kak. Coba kata lain, atau tambahkan lewat Vocabulary.`}
        />
      ) : (
        <div className="space-y-4">
          {results.map((entry) => (
            <ResultCard key={entry.id} entry={entry} onRelated={setQuery} />
          ))}
        </div>
      )}
    </div>
  );
}
