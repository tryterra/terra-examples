import type { ReactNode } from "react";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8">
      <p className="text-base text-subtle-text">{children}</p>
    </div>
  );
}
