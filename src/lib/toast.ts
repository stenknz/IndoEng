import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, tone?: ToastItem["tone"]) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "success") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
