"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/useAuth";
import { useStore } from "@/lib/store/useStore";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useToastStore } from "@/lib/toast";

const inputClass =
  "w-full max-w-sm rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted";

export function ProfilePage() {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refreshUser);
  const pushToast = useToastStore((s) => s.push);

  const [name, setName] = useState(user?.name ?? "");
  const [namePending, setNamePending] = useState(false);
  const [nameError, setNameError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleNameSave = async (e: FormEvent) => {
    e.preventDefault();
    setNameError("");
    setNamePending(true);
    try {
      // setUser performs the server PATCH (single write) and syncs local state.
      useStore.getState().setUser(name);
      await refreshUser();
      pushToast("Nama tersimpan");
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Gagal menyimpan nama");
    } finally {
      setNamePending(false);
    }
  };

  const handlePasswordSave = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Kata sandi baru tidak cocok");
      return;
    }
    setPasswordPending(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      pushToast("Kata sandi diubah");
    } catch (err) {
      if (err instanceof ApiError) setPasswordError(err.message);
      else setPasswordError("Gagal mengubah kata sandi");
    } finally {
      setPasswordPending(false);
    }
  };

  if (!user) return null;

  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your account details, name, and password.
        </p>
      </header>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Account
        </h2>
        <dl className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Email</dt>
            <dd className="truncate text-sm font-medium text-ink">
              {user.email}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Role</dt>
            <dd className="text-sm font-medium text-ink">
              {user.role === "admin" ? "Admin" : "Student"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Member since</dt>
            <dd className="text-sm font-medium text-ink">{memberSince}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Ubah nama
        </h2>
        <form onSubmit={handleNameSave} className="mt-3">
          <label htmlFor="profile-name" className={labelClass}>
            Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            className={inputClass}
          />
          {nameError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {nameError}
            </p>
          )}
          <div className="mt-3">
            <Button type="submit" size="sm" disabled={namePending || !name.trim()}>
              {namePending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Ubah kata sandi
        </h2>
        <form onSubmit={handlePasswordSave} className="mt-3 space-y-3">
          <div>
            <label htmlFor="profile-current-password" className={labelClass}>
              Kata sandi saat ini
            </label>
            <input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="profile-new-password" className={labelClass}>
              Kata sandi baru
            </label>
            <input
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="profile-confirm-password" className={labelClass}>
              Ulangi kata sandi baru
            </label>
            <input
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          {passwordError && (
            <p role="alert" className="text-sm text-red-600">
              {passwordError}
            </p>
          )}
          <div>
            <Button
              type="submit"
              size="sm"
              disabled={passwordPending || !currentPassword || !newPassword}
            >
              {passwordPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
