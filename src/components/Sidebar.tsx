"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store/useStore";
import { LevelBar } from "@/components/LevelBar";
import { metWordIds } from "@/lib/difficulty/learnerModel";
import { WORD_BANK } from "@/lib/data/words";

const NAV_ITEMS = [
  { href: "/", label: "Learn", emoji: "🏠" },
  { href: "/conversation", label: "Conversation", emoji: "💬" },
  { href: "/vocabulary", label: "Vocabulary", emoji: "📚" },
  { href: "/review", label: "Review", emoji: "🔄" },
  { href: "/progress", label: "Progress", emoji: "📈" },
  { href: "/settings", label: "Settings", emoji: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const words = useStore((s) => s.state.words);
  const level = useStore((s) => s.state.profile.level);

  const learned = metWordIds(words).length;
  const progress = Math.min(1, learned / WORD_BANK.length);

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? "bg-brand-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const navItems = NAV_ITEMS.map((item) => {
    const active =
      pathname === item.href ||
      (item.href === "/" && pathname.startsWith("/lesson"));
    return (
      <Link key={item.href} href={item.href} className={linkClass(active)}>
        <span className="text-base">{item.emoji}</span>
        <span>{item.label}</span>
      </Link>
    );
  });

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur md:hidden">
        <div className="px-4 py-3">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold tracking-tight text-brand-700">
              Kak
            </span>
            <span className="text-xs text-slate-400">belajar bahasa Indonesia</span>
          </div>
          <nav className="mt-2 flex gap-1 overflow-x-auto pb-1">{navItems}</nav>
        </div>
      </div>

      <aside className="hidden px-4 py-6 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-r md:border-slate-200 md:bg-white">
        <div className="flex items-baseline gap-1 px-2">
          <span className="text-2xl font-extrabold tracking-tight text-brand-700">
            Kak
          </span>
          <span className="text-xs text-slate-400">belajar bahasa Indonesia</span>
        </div>
        <nav className="mt-6 flex flex-col gap-1">{navItems}</nav>
        <div className="mt-auto pt-8">
          <LevelBar level={level} progress={progress} />
        </div>
      </aside>
    </>
  );
}
