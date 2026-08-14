"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store/useStore";
import { useAuth } from "@/lib/auth/useAuth";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { useToastStore } from "@/lib/toast";
import { speakText } from "@/lib/audio/speech";
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

function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        on ? "bg-canopy-600" : "bg-mist"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const state = useStore((s) => s.state);
  const user = useAuth((s) => s.user);
  const [saved, setSaved] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [tts, setTts] = useState<{
    provider: string;
    configured: boolean;
    voices: { id: string; name: string; language: string }[];
    defaultVoice: string;
  } | null>(null);
  const [name, setName] = useState(state.user.name);
  const nameTimerRef = useRef<number | null>(null);
  const pushToast = useToastStore((s) => s.push);

  const flushName = (next: string) => {
    if (nameTimerRef.current) {
      clearTimeout(nameTimerRef.current);
      nameTimerRef.current = null;
    }
    if (next.trim() === state.user.name) return;
    useStore.getState().setUser(next);
    setSaved(true);
    pushToast("Nama tersimpan");
    window.setTimeout(() => setSaved(false), 1500);
  };

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
      if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tts/info", {
      headers: { "x-kak-request": "1" },
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setTts(d);
      })
      .catch(() => {
        if (!cancelled) setTts(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNameChange = (next: string) => {
    setName(next); // live local input; the server write is debounced
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
    nameTimerRef.current = window.setTimeout(() => flushName(next), 500);
  };

  const handleNameBlur = () => {
    if (nameTimerRef.current) {
      clearTimeout(nameTimerRef.current);
      nameTimerRef.current = null;
    }
    flushName(name);
  };

  const handleModeChange = (mode: TranslationMode) => {
    useStore.getState().updateProfile({ translationMode: mode });
  };

  const selectedVoice = state.profile.ttsVoice ?? tts?.defaultVoice;

  const handlePronunciationChange = (on: boolean) => {
    useStore.getState().updateProfile({ pronunciationOn: on });
  };

  const handleAiTutorChange = (on: boolean) => {
    useStore.getState().updateProfile({ aiTutorOn: on });
  };

  const handleReset = () => {
    useStore.getState().resetAll();
    pushToast("Semua progres telah dihapus");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">Tune how Kak learns with you.</p>
      </header>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Akun
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {user?.name ?? "…"}
            </p>
            <p className="truncate text-sm text-muted">
              {user?.email ?? "…"} · {user?.role === "admin" ? "Admin" : "Student"}
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm font-semibold text-canopy-700 transition select-none hover:bg-canopy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canopy-600/40"
          >
            Kelola akun
          </Link>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Your name
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="What should we call you?"
            className="w-full max-w-xs rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15"
          />
          {saved && (
            <span className="text-sm font-medium text-canopy-700">✓ Saved</span>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
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
                    ? "border-canopy-600 bg-canopy-50"
                    : "border-ink/10 hover:border-ink/20"
                }`}
              >
                <input
                  type="radio"
                  name="translationMode"
                  value={mode.value}
                  checked={active}
                  onChange={() => handleModeChange(mode.value)}
                  className="mt-1 h-4 w-4 accent-canopy-600"
                />
                <span>
                  <span className="block font-semibold text-ink">
                    {mode.label}
                  </span>
                  <span className="block text-sm text-muted">
                    {mode.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          AI Tutor
        </h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Use Kak&apos;s AI tutor (OpenCode Go) for free conversation.
          </p>
          <Switch on={state.profile.aiTutorOn} onChange={handleAiTutorChange} />
        </div>
        {aiConfigured === false && (
          <p className="mt-3 rounded-xl bg-marigold-50 px-4 py-2.5 text-sm text-marigold-700">
            Belum aktif. Set OPENCODE_GO_API_KEY di file .env.local lalu mulai
            ulang server. Lihat README untuk petunjuk.
          </p>
        )}
        {aiConfigured === true && state.profile.aiTutorOn && (
          <p className="mt-3 text-sm font-medium text-canopy-700">
            AI tutor aktif untuk percakapan. ✓
          </p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Pronunciation
        </h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Show pronunciation guides alongside words.
          </p>
          <Switch
            on={state.profile.pronunciationOn}
            onChange={handlePronunciationChange}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Suara
        </h2>
        {tts === null ? (
          <p className="mt-3 text-sm text-muted">Memeriksa suara…</p>
        ) : tts.provider === "piper" && tts.configured ? (
          <>
            <p className="mt-3 text-sm font-medium text-canopy-700">
              Suara Piper (server) ✓
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="block text-sm font-medium text-ink">Suara</span>
                <select
                  aria-label="Suara"
                  value={selectedVoice ?? ""}
                  onChange={(e) =>
                    useStore
                      .getState()
                      .updateProfile({ ttsVoice: e.target.value })
                  }
                  className="mt-1 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15"
                >
                  {state.profile.ttsVoice === null && tts.defaultVoice && (
                    <option value={tts.defaultVoice}>Default</option>
                  )}
                  {tts.voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void speakText("Halo, selamat pagi. Apa kabar?", {
                    voice: selectedVoice,
                  });
                }}
              >
                Coba
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-marigold-50 px-4 py-2.5 text-sm text-marigold-700">
            Suara perangkat (browser) — untuk suara terbaik aktifkan Piper
            (server).
          </p>
        )}
      </Card>

      <Card className="border-red-200 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-red-500">
          Danger zone
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Clear all words, lessons, and history. This cannot be undone.
          </p>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            Reset all data
          </Button>
        </div>
      </Card>

      <Modal
        open={resetOpen}
        title="Hapus semua progres?"
        confirmLabel="Hapus semua"
        onConfirm={handleReset}
        onClose={() => setResetOpen(false)}
      >
        This clears your words, lessons, and conversation history. This cannot
        be undone.
      </Modal>
    </div>
  );
}
