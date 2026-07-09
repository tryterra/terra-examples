import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import type { ReactNode } from "react";
import { Link } from "@/client/components/shared/atoms/Link";

export function MetricCard({
  to,
  icon,
  title,
  unit,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  unit: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-lg border border-border bg-white p-4 no-underline transition-shadow hover:shadow-card"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emphasis-bg">
        {icon}
      </span>
      <div className="flex flex-1 flex-col">
        <span className="text-base font-medium text-main-black">{title}</span>
        <span className="text-sm text-subtle-text font-normal">{unit}</span>
      </div>
      <CaretRightIcon
        size={20}
        className="shrink-0 text-subtle-text group-hover:text-emphasis"
      />
    </Link>
  );
}
