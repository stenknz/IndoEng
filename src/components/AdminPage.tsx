"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api/client";
import { useAuth, type PublicUser } from "@/lib/auth/useAuth";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { useToastStore } from "@/lib/toast";

export function AdminPage() {
  const user = useAuth((s) => s.user);
  const pushToast = useToastStore((s) => s.push);

  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetTarget, setResetTarget] = useState<PublicUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUsers = async () => {
    setError("");
    try {
      const list = await apiFetch<PublicUser[]>("/api/admin/users");
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar pengguna");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") void loadUsers();
  }, [user?.role]);

  const toggleUser = async (target: PublicUser) => {
    setBusyId(target.id);
    setError("");
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(target.id)}`, {
        method: "PATCH",
        body: { disabled: !target.disabledAt },
      });
      pushToast(target.disabledAt ? "Pengguna diaktifkan" : "Pengguna dinonaktifkan");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status pengguna");
    } finally {
      setBusyId(null);
    }
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    setError("");
    try {
      await apiFetch(
        `/api/admin/users/${encodeURIComponent(resetTarget.id)}/reset-password`,
        { method: "POST", body: { newPassword: resetPassword } },
      );
      pushToast("Kata sandi telah direset");
      setResetTarget(null);
      setResetPassword("");
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Gagal mereset kata sandi pengguna",
      );
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Admin
          </h1>
        </header>
        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Akses ditolak
          </h2>
          <p className="mt-2 text-sm text-muted">
            Halaman ini hanya untuk administrator.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Admin
        </h1>
        <p className="mt-1 text-sm text-muted">
          Kelola akun pengguna Kak.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/5 text-xs font-semibold uppercase tracking-widest text-muted">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-muted">
                    Memuat…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-muted">
                    Belum ada pengguna.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="transition hover:bg-canopy-50/50">
                    <td className="px-6 py-3 font-medium text-ink">
                      {u.name}
                      {u.id === user.id && (
                        <span className="ml-2 text-xs font-normal text-muted">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-muted">{u.email}</td>
                    <td className="px-6 py-3 text-muted">
                      {u.role === "admin" ? "Admin" : "Student"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.disabledAt
                            ? "bg-red-50 text-red-600"
                            : "bg-canopy-50 text-canopy-700"
                        }`}
                      >
                        {u.disabledAt ? "Nonaktif" : "Aktif"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={u.id === user.id || busyId === u.id}
                          onClick={() => void toggleUser(u)}
                        >
                          {u.disabledAt ? "Aktifkan" : "Nonaktifkan"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === u.id}
                          onClick={() => {
                            setResetPassword("");
                            setResetTarget(u);
                          }}
                        >
                          Reset sandi
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={resetTarget !== null}
        title="Reset kata sandi"
        confirmLabel="Reset"
        onConfirm={() => void submitReset()}
        onClose={() => {
          setResetTarget(null);
          setResetPassword("");
        }}
      >
        {resetTarget && (
          <div className="space-y-3">
            <p>
              Atur kata sandi baru untuk{" "}
              <span className="font-semibold text-ink">
                {resetTarget.name} ({resetTarget.email})
              </span>
              .
            </p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Kata sandi baru"
              className="w-full rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-canopy-600 focus:ring-2 focus:ring-canopy-600/15"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
