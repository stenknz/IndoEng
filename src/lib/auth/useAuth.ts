"use client";
import { create } from "zustand";
import { apiFetch } from "@/lib/api/client";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
  createdAt: number;
  disabledAt: number | null;
}

interface AuthState {
  status: "loading" | "guest" | "authed";
  user: PublicUser | null;
  init: () => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  init: async () => {
    try {
      const { user } = await apiFetch<{ user: PublicUser }>("/api/auth/me");
      set({ status: "authed", user });
    } catch {
      set({ status: "guest", user: null });
    }
  },
  login: async (email, password, remember) => {
    const { user } = await apiFetch<{ user: PublicUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password, remember },
    });
    set({ status: "authed", user });
  },
  register: async (email, name, password) => {
    const { user } = await apiFetch<{ user: PublicUser }>("/api/auth/register", {
      method: "POST",
      body: { email, name, password },
    });
    set({ status: "authed", user });
  },
  logout: async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    set({ status: "guest", user: null });
  },
  refreshUser: async () => {
    const { user } = await apiFetch<{ user: PublicUser }>("/api/auth/me");
    set({ user });
  },
}));
