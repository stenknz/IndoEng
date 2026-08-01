"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store/useStore";
import { TutorEngine } from "@/lib/engine/engine";
import { knownWordIds } from "@/lib/difficulty/learnerModel";
import { LESSONS } from "@/lib/data/lessons";
import { ChatWindow } from "@/components/ChatWindow";
import type { ConversationMessage } from "@/lib/types";

export function ConversationPage() {
  const state = useStore((s) => s.state);
  const hydrated = useStore((s) => s.hydrated);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const bumpWord = useStore((s) => s.bumpWord);
  const updateProfile = useStore((s) => s.updateProfile);
  const saveConversation = useStore((s) => s.saveConversation);

  const engineRef = useRef<TutorEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TutorEngine();
  const engine = engineRef.current;

  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [startedAt, setStartedAt] = useState(0);

  async function persistConversation(
    id: string,
    start: number,
    msgs: ConversationMessage[],
  ) {
    saveConversation({
      id,
      lessonId: LESSONS[0].id,
      startedAt: start,
      messages: msgs,
    });
  }

  async function startFresh() {
    const seed = await engine.startLesson(useStore.getState().state, LESSONS[0]);
    const id = crypto.randomUUID();
    const start = Date.now();
    setConversationId(id);
    setStartedAt(start);
    setMessages(seed);
    persistConversation(id, start, seed);
  }

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      const last = useStore.getState().state.conversations.at(-1);
      if (last) {
        if (!cancelled) {
          setConversationId(last.id);
          setStartedAt(last.startedAt);
          setMessages(last.messages);
          setReady(true);
        }
        return;
      }
      const seed = await engine.startLesson(useStore.getState().state, LESSONS[0]);
      if (cancelled) return;
      const id = crypto.randomUUID();
      const start = Date.now();
      setConversationId(id);
      setStartedAt(start);
      setMessages(seed);
      persistConversation(id, start, seed);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || !conversationId) return;
    setBusy(true);
    setError(null);
    setInput("");
    const learnerMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      kind: "learner",
      content: text,
      timestamp: Date.now(),
    };
    const history = [...messages, learnerMsg];
    setMessages(history);
    try {
      const out = await engine.respond(
        useStore.getState().state,
        LESSONS[0],
        history,
        text,
        "conversation",
      );
      const updated = [...history, out.message];
      setMessages(updated);
      for (const a of out.attempts) recordAttempt(a);
      for (const [id, res] of Object.entries(out.wordsToRecord)) bumpWord(id, res);
      updateProfile(out.adaptedProfile);
      persistConversation(conversationId, startedAt, updated);
    } catch {
      setMessages(messages);
      setError("Ada masalah. Coba lagi. 🙏");
    } finally {
      setBusy(false);
    }
  }

  function handleNew() {
    if (busy) return;
    void startFresh();
  }

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Memuat…
      </div>
    );
  }

  if (knownWordIds(state.words).length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Ngobrol dengan Kak 💬</h1>
          <p className="mt-1 text-slate-500">
            Bicara bahasa Indonesia dengan Kak, tutor kamu.
          </p>
        </header>
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🌱</div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">
            Selesaikan Lesson 1 dulu, ya!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-slate-500">
            Kak belum tahu kata-kata kamu. Belajar kata pertama dulu supaya Kak
            bisa mengobrol denganmu.
          </p>
          <Link
            href={`/lesson/${LESSONS[0].id}`}
            className="mt-5 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Mulai Lesson 1 →
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ngobrol dengan Kak 💬</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kak cuma pakai kata-kata yang kamu sudah tahu.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          disabled={busy}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          New conversation
        </button>
      </header>

      <ChatWindow
        messages={messages}
        translationMode={state.profile.translationMode}
      />

      {busy && (
        <div className="px-1 text-xs text-slate-400">Kak sedang berpikir…</div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Tulis dalam bahasa Indonesia…"
          autoComplete="off"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={busy || input.trim() === ""}
          className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-50"
        >
          Kirim
        </button>
      </form>
    </div>
  );
}
