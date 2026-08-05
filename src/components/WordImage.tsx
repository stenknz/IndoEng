import Image from "next/image";

type WordImageProps = {
  src?: string;
  alt: string;
  aspect?: "video" | "square";
  className?: string;
};

const aspectClasses = {
  video: "aspect-video",
  square: "aspect-square",
};

export function WordImage({
  src,
  alt,
  aspect = "square",
  className = "",
}: WordImageProps) {
  if (!src) return null;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-ink/5 bg-mist ${aspectClasses[aspect]} ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 640px"
        className="object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
