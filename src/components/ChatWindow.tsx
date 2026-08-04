"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakButton } from "@/components/SpeakButton";
import { Waveform } from "@/components/Waveform";
import type { ConversationMessage, TranslationMode } from "@/lib/types";

function TutorBubble({
  message,
  translationMode,
}: {
  message: ConversationMessage;
  translationMode: TranslationMode;
}) {
  const [showHint, setShowHint] = useState(false);
  const [showTranslation, setShowTranslation] = useState(
    translationMode === "beginner",
  );

  useEffect(() => {
    setShowTranslation(translationMode === "beginner");
  }, [translationMode]);

  const hasActions = Boolean(message.hint || message.translation);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-ink/5 bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-1.5">
              <Waveform className="opacity-70" />
            </span>
            <span>{message.content}</span>
          </div>
          <SpeakButton text={message.content} />
        </div>
        {hasActions && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.hint && (
              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  showHint
                    ? "bg-marigold-100 text-marigold-700"
                    : "bg-mist text-muted hover:bg-canopy-100"
                }`}
              >
                💡 Hint
              </button>
            )}
            {message.translation && (
              <button
                type="button"
                onClick={() => setShowTranslation((v) => !v)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  showTranslation
                    ? "bg-canopy-100 text-canopy-700"
                    : "bg-mist text-muted hover:bg-canopy-100"
                }`}
              >
                {showTranslation ? "🇬🇧 English" : "Translate"}
              </button>
            )}
          </div>
        )}
        {showHint && message.hint && (
          <div className="mt-2 rounded-lg bg-marigold-50 px-3 py-2 text-xs text-marigold-700">
            💡 {message.hint}
          </div>
        )}
        {showTranslation && message.translation && (
          <div className="mt-2 rounded-lg bg-canopy-50 px-3 py-2 text-xs text-canopy-700">
            {message.translation}
          </div>
        )}
      </div>
    </div>
  );
}

function LearnerBubble({ message }: { message: ConversationMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-canopy-600 px-4 py-3 text-sm leading-relaxed text-white shadow-card">
        {message.content}
      </div>
    </div>
  );
}

export function ChatWindow({
  messages,
  translationMode,
}: {
  messages: ConversationMessage[];
  translationMode: TranslationMode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-ink/5 bg-white p-4 shadow-card"
    >
      {messages.map((m) =>
        m.kind === "tutor" ? (
          <TutorBubble key={m.id} message={m} translationMode={translationMode} />
        ) : (
          <LearnerBubble key={m.id} message={m} />
        ),
      )}
    </div>
  );
}
