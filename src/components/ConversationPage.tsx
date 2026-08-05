"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store/useStore";
import { TutorEngine } from "@/lib/engine/engine";
import { autoProvider } from "@/lib/engine/autoProvider";
import { metWordIds } from "@/lib/difficulty/learnerModel";
import { LESSONS } from "@/lib/data/lessons";
import { ChatWindow } from "@/components/ChatWindow";
import { Waveform } from "@/components/Waveform";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import type { ConversationMessage } from "@/lib/types";

export function ConversationPage() {
  const state = useStore((s) => s.state);
  const hydrated = useStore((s) => s.hydrated);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const bumpWord = useStore((s) => s.bumpWord);
  const updateProfile = useStore((s) => s.updateProfile);
  const saveConversation = useStore((s) => s.saveConversation);
  const addSession = useStore((s) => s.addSession);

  const engineRef = useRef<TutorEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TutorEngine(autoProvider);
  const engine = engineRef.current;

  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [startedAt, setStartedAt] = useState(0);

  const hadUserTurnRef = useRef(false);
  const bumpedWordsRef = useRef(0);
  const sessionCommittedRef = useRef(false);
  const messagesRef = useRef<ConversationMessage[]>([]);
  messagesRef.current = messages;

  // Record a learning session when the learner leaves the conversation, so
  // time spent chatting counts toward the daily goal and streak.
  useEffect(() => {
    return () => {
      const s = sessionCommittedRef.current;
      if (s || !hadUserTurnRef.current) return;
      sessionCommittedRef.current = true;
      const durationMin = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 60000),
      );
      addSession({
        id: crypto.randomUUID(),
        ts: Date.now(),
        durationMin,
        wordsReviewed: bumpedWordsRef.current,
        newWords: 0,
        recallRate: 1,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

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
    setError(null);
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
    hadUserTurnRef.current = true;
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
      for (const [id, res] of Object.entries(out.wordsToRecord)) {
        bumpWord(id, res);
        bumpedWordsRef.current += 1;
      }
      updateProfile({
        currentDifficulty: out.adaptedProfile.currentDifficulty,
        level: out.adaptedProfile.level,
      });
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
      <div className="flex h-[calc(100dvh-10rem)] flex-col gap-4">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Ngobrol dengan Kak
          </h1>
          <Skeleton className="mt-2 h-4 w-64" />
        </header>
        <div className="flex-1 space-y-3 rounded-2xl border border-ink/5 bg-white p-4 shadow-card">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-12 w-1/2 self-end" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    );
  }

  if (!state.profile.aiTutorOn && metWordIds(state.words).length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Ngobrol dengan Kak
          </h1>
          <p className="mt-1 text-sm text-muted">
            Bicara bahasa Indonesia dengan Kak, tutor kamu.
          </p>
        </header>
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-canopy-50 text-3xl">
            🌱
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
            Selesaikan Lesson 1 dulu, ya!
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Kak belum tahu kata-kata kamu. Belajar kata pertama dulu supaya Kak
            bisa mengobrol denganmu.
          </p>
          <div className="mt-6 flex justify-center">
            <Button>
              <Link href={`/lesson/${LESSONS[0].id}`}>Mulai Lesson 1 →</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Ngobrol dengan Kak
          </h1>
          <p className="mt-1 text-sm text-muted">
            {state.profile.aiTutorOn
              ? "Kak bisa ngobrol apa saja — pelan-pelan dan sabar."
              : "Kak cuma pakai kata-kata yang kamu sudah tahu."}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleNew} disabled={busy}>
          New conversation
        </Button>
      </header>

      <ChatWindow
        messages={messages}
        translationMode={state.profile.translationMode}
      />

      {busy && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted">
          <Waveform active />
          Kak sedang berpikir…
        </div>
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
          className="flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15 disabled:bg-mist/60"
        />
        <Button type="submit" disabled={busy || input.trim() === ""}>
          Kirim
        </Button>
      </form>
    </div>
  );
}
