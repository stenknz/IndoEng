"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useStore } from "@/lib/store/useStore";
import { createInitialState } from "@/lib/store/localStore";
import { useAuth } from "@/lib/auth/useAuth";
import { AuthPage } from "@/components/AuthPage";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useAuth((s) => s.status);
  const init = useAuth((s) => s.init);

  useEffect(() => {
    void init().then(() => {
      if (useAuth.getState().status === "authed") {
        void useStore.getState().hydrate().catch(() => {});
      }
    });
  }, [init]);

  useEffect(() => {
    if (status === "guest") {
      useStore.setState({ state: createInitialState(""), hydrated: false });
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        …
      </div>
    );
  }
  if (status === "guest") return <AuthPage />;

  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="flex-1">
        <div
          key={pathname}
          className="mx-auto w-full max-w-3xl animate-fade-up px-4 py-8 sm:px-6 lg:px-8"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
