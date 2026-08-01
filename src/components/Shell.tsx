"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useStore } from "@/lib/store/useStore";

export function Shell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useStore.getState().hydrate();
  }, []);

  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
