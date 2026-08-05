"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store/useStore";
import { LevelBar } from "@/components/LevelBar";
import { Waveform } from "@/components/Waveform";
import { Icon, type IconName } from "@/components/Icon";
import { metWordIds } from "@/lib/difficulty/learnerModel";
import { WORD_BANK } from "@/lib/data/words";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Learn", icon: "home" },
  { href: "/conversation", label: "Conversation", icon: "chat" },
  { href: "/translate", label: "Translate", icon: "globe" },
  { href: "/vocabulary", label: "Vocabulary", icon: "book" },
  { href: "/review", label: "Review", icon: "refresh" },
  { href: "/progress", label: "Progress", icon: "chart" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const words = useStore((s) => s.state.words);
  const level = useStore((s) => s.state.profile.level);

  const learned = metWordIds(words).length;
  const progress = Math.min(1, learned / WORD_BANK.length);

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? "bg-canopy-600 text-white shadow-card"
        : "text-muted hover:bg-canopy-50 hover:text-ink"
    }`;

  const navItems = NAV_ITEMS.map((item) => {
    const active =
      pathname === item.href ||
      (item.href === "/" && pathname.startsWith("/lesson"));
    return (
      <Link key={item.href} href={item.href} className={linkClass(active)}>
        <Icon name={item.icon} className="h-5 w-5 shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  });

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-ink/5 bg-paper/90 backdrop-blur md:hidden">
        <div className="px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Waveform />
            <span className="font-display text-xl font-bold tracking-tight text-canopy-700">
              Kak
            </span>
            <span className="text-xs text-muted">
              belajar bahasa Indonesia
            </span>
          </Link>
          <nav className="mt-2 flex gap-1 overflow-x-auto pb-1">{navItems}</nav>
        </div>
      </div>

      <aside className="hidden px-5 py-6 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-r md:border-ink/5 md:bg-white/60 md:backdrop-blur">
        <Link href="/" className="flex items-center gap-2 px-2">
          <Waveform />
          <span className="font-display text-2xl font-bold tracking-tight text-canopy-700">
            Kak
          </span>
        </Link>
        <p className="mt-0.5 px-2 text-xs text-muted">
          belajar bahasa Indonesia
        </p>
        <nav className="mt-6 flex flex-col gap-1">{navItems}</nav>
        <div className="mt-auto pt-8">
          <div className="rounded-2xl border border-ink/5 bg-paper p-4">
            <LevelBar level={level} progress={progress} />
          </div>
        </div>
      </aside>
    </>
  );
}
