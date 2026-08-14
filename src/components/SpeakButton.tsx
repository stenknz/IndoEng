"use client";

import { useEffect, useState } from "react";
import { speakText } from "@/lib/audio/speech";
import { useStore } from "@/lib/store/useStore";

export function SpeakButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [hint, setHint] = useState(false);
  const ttsVoice = useStore((s) => s.state.profile.ttsVoice);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          const ok = await speakText(text, { voice: ttsVoice ?? undefined });
          if (!ok) setHint(true);
        }}
        aria-label={`Dengarkan ${text}`}
        title="Putar pelafalan"
        className={`rounded-full bg-canopy-50 p-2.5 text-base text-canopy-700 transition hover:bg-canopy-100 ${className}`}
      >
        🔊
      </button>
      {hint && (
        <span className="text-xs text-amber-600">
          Tidak dapat memutar suara. Coba nyalakan Piper (server) di Pengaturan.
        </span>
      )}
    </span>
  );
}
