import { cn, publicUrl } from "@/lib/utils";

export function BrandMark({
  variant = "mark",
  className,
  alt,
}: {
  variant?: "mark" | "lockup";
  className?: string;
  alt?: string;
}) {
  const lockup = variant === "lockup";
  return (
    <img
      src={lockup ? publicUrl("brand/logo.jpg") : publicUrl("brand/mark.png")}
      alt={alt ?? (lockup ? "Media Manager" : "")}
      className={cn("object-contain select-none", lockup && "bg-ink", className)}
      draggable={false}
    />
  );
}

export function BrandWordmark({
  compact,
  tagline,
  className,
}: {
  compact?: boolean;
  tagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("font-display leading-none", compact ? "text-xs" : "text-2xl")}>
        <span className="text-gold">MEDIA</span> <span className="text-silver">MANAGER</span>
      </p>
      <p
        className={cn(
          "text-gold/85",
          compact ? "mt-1 text-xs tracking-[0.22em]" : "mt-3 text-xs tracking-[0.28em]",
        )}
      >
        621 / FileManager
      </p>
      {tagline ? (
        <p className="mt-3 text-[10px] tracking-[0.22em] text-silver/75">ACCESS TO EACH FILE OF MOBILE</p>
      ) : null}
    </div>
  );
}
