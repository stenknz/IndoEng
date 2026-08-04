"use client";

import { useToastStore } from "@/lib/toast";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 sm:left-auto sm:right-5 sm:translate-x-0 sm:items-end sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-fade-up pointer-events-auto flex items-center gap-2.5 rounded-xl border border-ink/5 bg-white px-4 py-3 text-sm font-medium text-ink shadow-lift"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
              t.tone === "success"
                ? "bg-canopy-600"
                : t.tone === "error"
                  ? "bg-red-500"
                  : "bg-marigold-500"
            }`}
          >
            {t.tone === "success" ? "✓" : t.tone === "error" ? "!" : "•"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
