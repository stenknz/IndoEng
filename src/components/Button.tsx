import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canopy-600/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-canopy-600 text-white shadow-card hover:bg-canopy-700",
  secondary: "border border-ink/10 bg-white text-ink hover:bg-canopy-50",
  ghost: "text-canopy-700 hover:bg-canopy-50",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  inverse: "bg-white text-canopy-700 shadow-card hover:bg-mist",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3.5 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
