import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { twMerge } from "tailwind-merge";

/**
 * Overview KPI tile. `warn` swaps to the warning palette (tint + value colour);
 * `tone="emphasis"` colours just the value. An optional `link` makes the whole
 * card a router link; `onClick` makes it a toggle button instead (`active`
 * marks the expanded state).
 */
export function KpiCard({
  label,
  value,
  tone = "neutral",
  warn = false,
  sublabel,
  link,
  onClick,
  active = false,
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "emphasis";
  warn?: boolean;
  sublabel?: ReactNode;
  link?: LinkProps;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span className="text-sm text-secondary-text">{label}</span>
      <span
        className={twMerge(
          "text-[28px] font-semibold leading-tight",
          warn
            ? "text-warning"
            : tone === "emphasis"
              ? "text-emphasis"
              : "text-main-black",
        )}
      >
        {value}
      </span>
      {sublabel && <span className="text-xs text-subtle-text">{sublabel}</span>}
    </>
  );

  const className = twMerge(
    "flex flex-col gap-1 rounded-lg border border-border bg-white p-4",
    warn && "border-warning bg-warning-bg",
    (link || onClick) && "transition hover:border-emphasis-secondary",
    active && "border-emphasis-secondary shadow-card",
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={twMerge(className, "cursor-pointer text-left")}
      >
        {body}
      </button>
    );
  }
  return link ? (
    <Link {...link} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
