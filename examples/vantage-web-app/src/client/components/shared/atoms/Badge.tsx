import type { ReactNode } from "react";
import { tv } from "tailwind-variants";

const styles = tv({
  base: "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-sm font-medium",
  variants: {
    variant: {
      emphasis: "border-emphasis-secondary bg-emphasis-bg text-emphasis",
      warning: "border-warning bg-warning-bg text-warning",
      neutral: "border-border text-subtle-text",
    },
  },
  defaultVariants: {
    variant: "emphasis",
  },
});

export function Badge({
  variant = "emphasis",
  children,
  className,
}: {
  variant?: "emphasis" | "warning" | "neutral";
  children: ReactNode;
  className?: string;
}) {
  return <span className={styles({ variant, className })}>{children}</span>;
}
