import type { ReactNode } from "react";
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  type BreadcrumbProps,
  type BreadcrumbsProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";
import { Link } from "./Link";
import { composeTailwindRenderProps } from "./utils";

export function Breadcrumbs<T extends object>(props: BreadcrumbsProps<T>) {
  return (
    <AriaBreadcrumbs
      {...props}
      className={twMerge("flex min-w-0 gap-1", props.className)}
    />
  );
}

interface BreadcrumbItemProps extends BreadcrumbProps {
  to?: string;
  children: ReactNode;
}

export function Breadcrumb({ to, children, ...props }: BreadcrumbItemProps) {
  return (
    <AriaBreadcrumb
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex items-center gap-1 shrink-0 last:shrink last:min-w-0",
      )}
    >
      {({ isCurrent }) => (
        <>
          <Link
            to={to ?? "."}
            className={`text-sm font-medium text-main-black no-underline h-7 px-2 rounded-lg hover:bg-hover-grey pressed:bg-pressed-grey cursor-pointer justify-center items-center flex ${isCurrent ? "min-w-0 truncate" : "whitespace-nowrap shrink-0"}`}
          >
            {children}
          </Link>
          {!isCurrent && (
            <span className="text-sm font-light text-subtle-text">/</span>
          )}
        </>
      )}
    </AriaBreadcrumb>
  );
}
