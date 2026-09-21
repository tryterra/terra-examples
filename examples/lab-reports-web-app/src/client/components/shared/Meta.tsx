/**
 * Labeled metadata: a tiny uppercase label above its value. Use rows of
 * these instead of dot-separated strings ("47 y · Female · demo-user").
 */
import type { ReactNode } from "react";

export function MetaRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-x-8 gap-y-3">{children}</div>;
}

export function Meta({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-wider text-subtle-text uppercase">
        {label}
      </span>
      <span
        className={`text-sm text-main-black ${mono ? "font-mono text-xs leading-5" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}
