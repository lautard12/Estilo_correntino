import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number) => void;
  max?: number;
  size?: "sm" | "md";
  readOnly?: boolean;
}

export function StarRating({ value, onChange, max = 10, size = "md", readOnly = false }: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className="flex gap-0.5">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={cn(
            "p-0 border-0 bg-transparent transition-colors",
            readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"
          )}
          onClick={() => {
            if (!readOnly && onChange) {
              onChange(star === value ? 0 : star);
            }
          }}
        >
          <Star
            className={cn(
              iconSize,
              star <= (value ?? 0)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

/** Compact inline display: filled stars + number */
export function StarRatingDisplay({ value, max = 10, size = "sm" }: { value: number | null; max?: number; size?: "sm" | "md" }) {
  if (value == null || value === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5">
      <Star className={cn(iconSize, "fill-amber-400 text-amber-400")} />
      <span className="text-xs font-medium">{value}/{max}</span>
    </span>
  );
}
