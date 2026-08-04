export function ProgressBar({
  value,
  tone = "canopy",
  className = "",
}: {
  value: number;
  tone?: "canopy" | "marigold";
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-mist ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${
          tone === "canopy" ? "bg-canopy-600" : "bg-marigold-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
