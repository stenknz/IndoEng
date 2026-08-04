"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useStore } from "@/lib/store/useStore";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    useStore.getState().hydrate();
  }, []);

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
