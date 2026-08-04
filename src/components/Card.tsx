import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink/5 bg-white shadow-card ${
        hover
          ? "transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
