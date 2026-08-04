"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/Button";

export function Modal({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop relative w-full max-w-sm rounded-2xl border border-ink/5 bg-white p-6 shadow-lift"
      >
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
