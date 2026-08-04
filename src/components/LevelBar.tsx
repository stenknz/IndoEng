"use client";

interface LevelBarProps {
  level: number;
  progress: number;
}

export function LevelBar({ level, progress }: LevelBarProps) {
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * 10);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          Level {level + 1}
        </span>
        <span className="font-display text-sm font-semibold text-canopy-700">
          {filled * 10}%
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors duration-500 ${
              i < filled ? "bg-canopy-600" : "bg-mist"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
