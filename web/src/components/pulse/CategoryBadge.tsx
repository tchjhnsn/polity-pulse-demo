import type { CategoryId } from "@/lib/repTypes";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: { id: CategoryId; label: string; color: string; wash: string };
  className?: string;
}

/** A category badge with its own color (separate from the layer-badge axis).
 * Per the taxonomy doc, categories are an organizational axis, not just a
 * decorative tag — each gets its own color so the filter row reads as
 * distinct from the layer badges. */
export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        backgroundColor: category.wash,
        color: category.color,
        border: `1px solid ${category.color}33`,
      }}
      title={category.label}
    >
      {category.label}
    </span>
  );
}