"use client";

interface LevelBarProps {
  level: number;
  progress: number;
}

export function LevelBar({ level, progress }: LevelBarProps) {
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * 10);

  return (
    <div>
      <div className="text-sm font-semibold text-slate-700">
        Indonesian Level {level + 1}
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i < filled ? "bg-brand-500" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
