"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import type { TranslationMode } from "@/lib/types";

const MODES: { value: TranslationMode; label: string; description: string }[] = [
  {
    value: "beginner",
    label: "Beginner",
    description: "Indonesian + English translations",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "Mostly Indonesian, translation when needed",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Almost all Indonesian",
  },
];

export function SettingsPage() {
  const state = useStore((s) => s.state);
  const [saved, setSaved] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tutor")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        if (!cancelled) setAiConfigured(Boolean(d.configured));
      })
      .catch(() => {
        if (!cancelled) setAiConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNameChange = (name: string) => {
    useStore.getState().setUser(name);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const handleModeChange = (mode: TranslationMode) => {
    useStore.getState().updateProfile({ translationMode: mode });
  };

  const handlePronunciationChange = (on: boolean) => {
    useStore.getState().updateProfile({ pronunciationOn: on });
  };

  const handleAiTutorChange = (on: boolean) => {
    useStore.getState().updateProfile({ aiTutorOn: on });
  };

  const handleReset = () => {
    if (
      window.confirm(
        "Reset all progress? This clears your words, lessons, and history. This cannot be undone.",
      )
    ) {
      useStore.getState().resetAll();
      setResetDone(true);
      window.setTimeout(() => setResetDone(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">⚙️ Settings</h1>
        <p className="mt-1 text-slate-500">
          Tune how Kak learns with you.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Your name
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="text"
            value={state.user.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="What should we call you?"
            className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          {saved && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Saved
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Translation mode
        </h2>
        <div className="mt-4 space-y-3">
          {MODES.map((mode) => {
            const active = state.profile.translationMode === mode.value;
            return (
              <label
                key={mode.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  active
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="translationMode"
                  value={mode.value}
                  checked={active}
                  onChange={() => handleModeChange(mode.value)}
                  className="mt-1 h-4 w-4 accent-brand-600"
                />
                <span>
                  <span className="block font-semibold text-slate-800">
                    {mode.label}
                  </span>
                  <span className="block text-sm text-slate-500">
                    {mode.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          AI Tutor
        </h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            Use Kak's AI tutor (OpenCode Go) for free conversation.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={state.profile.aiTutorOn}
            onClick={() => handleAiTutorChange(!state.profile.aiTutorOn)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              state.profile.aiTutorOn ? "bg-brand-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                state.profile.aiTutorOn ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
        {aiConfigured === false && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            Belum aktif. Set OPENCODE_GO_API_KEY di file .env.local lalu mulai
            ulang server. Lihat README untuk petunjuk.
          </p>
        )}
        {aiConfigured === true && state.profile.aiTutorOn && (
          <p className="mt-3 text-sm font-medium text-emerald-600">
            AI tutor aktif untuk percakapan. ✓
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Pronunciation
        </h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            Show pronunciation guides alongside words.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={state.profile.pronunciationOn}
            onClick={() =>
              handlePronunciationChange(!state.profile.pronunciationOn)
            }
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              state.profile.pronunciationOn
                ? "bg-brand-600"
                : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                state.profile.pronunciationOn ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-red-500">
          Danger zone
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            Clear all words, lessons, and history. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Reset all data
          </button>
        </div>
        {resetDone && (
          <p className="mt-3 text-sm font-medium text-emerald-600">
            Progress has been reset.
          </p>
        )}
      </section>
    </div>
  );
}
