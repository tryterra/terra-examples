import { twMerge } from "tailwind-merge";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={twMerge("shimmer shimmer-bg bg-border rounded-lg", className)}
    />
  );
}
