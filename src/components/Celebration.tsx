export function Celebration({ label }: { label: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-pop flex items-center gap-3 rounded-full bg-marigold-500 px-8 py-5 text-ink shadow-lift">
        <span className="text-2xl">🎉</span>
        <span className="font-display text-2xl font-bold">{label}</span>
      </div>
    </div>
  );
}
