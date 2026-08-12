"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Waveform } from "@/components/Waveform";

type Mode = "login" | "register";

const inputClass =
  "w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);

  const isLogin = mode === "login";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      if (isLogin) {
        await login(email, password, remember);
      } else {
        await register(email, name, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <Waveform />
            <span className="font-display text-3xl font-bold tracking-tight text-canopy-700">
              Kak
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">belajar bahasa Indonesia</p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="flex rounded-full border border-ink/10 bg-paper p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isLogin ? "bg-canopy-600 text-white shadow-card" : "text-muted hover:bg-canopy-50"
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                !isLogin ? "bg-canopy-600 text-white shadow-card" : "text-muted hover:bg-canopy-50"
              }`}
            >
              Daftar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="auth-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  placeholder="What should we call you?"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className={labelClass}>
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="auth-password" className={labelClass}>
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            {isLogin && (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded accent-canopy-600"
                />
                Remember me
              </label>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending
                ? isLogin
                  ? "Logging in…"
                  : "Creating account…"
                : isLogin
                  ? "Masuk"
                  : "Daftar"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
