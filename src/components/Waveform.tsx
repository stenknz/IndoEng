const HEIGHTS = [10, 16, 22, 14, 8];

export function Waveform({
  active = false,
  light = false,
  className = "",
}: {
  active?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-end gap-[3px] ${className}`}
      aria-hidden="true"
    >
      {HEIGHTS.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${
            light ? "bg-white/90" : "bg-canopy-600"
          } ${active ? "animate-wave" : ""}`}
          style={{
            height: h,
            animationDelay: `${i * 0.13}s`,
            transformOrigin: "bottom",
          }}
        />
      ))}
    </span>
  );
}
