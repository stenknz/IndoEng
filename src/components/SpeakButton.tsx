"use client";

import { useEffect, useState } from "react";
import { browserTTS } from "@/lib/audio/browserTTS";

export function SpeakButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !browserTTS.supported) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const ok = browserTTS.speak(text);
          if (!ok) setHint(true);
        }}
        aria-label={`Dengarkan ${text}`}
        title={
          browserTTS.voiceAvailable
            ? "Putar pelafalan"
            : "Belum ada suara bahasa Indonesia di perangkat ini"
        }
        className={`rounded-full bg-brand-50 p-2.5 text-base text-brand-700 transition hover:bg-brand-100 ${className}`}
      >
        🔊
      </button>
      {hint && (
        <span className="text-xs text-amber-600">
          Pasang suara Indonesia (System Settings → Accessibility → Spoken
          Content) lalu muat ulang.
        </span>
      )}
    </span>
  );
}
