import type { NotFoundRouteProps } from "@tanstack/react-router";
import { Link } from "@/client/components/shared/atoms/Link";

export function NotFoundPage(
  props: NotFoundRouteProps & { className?: string },
) {
  const { className } = props;
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center px-4 ${className ?? "min-h-screen bg-bg-grey"}`}
    >
      <div className="flex w-full max-w-90 flex-col gap-12 text-center">
        <div className="flex w-full flex-col gap-6 text-center">
          <h1 className="text-8xl font-bold text-main-black">404</h1>
          <p className="text-base text-secondary-text">
            This page doesn't exist.
          </p>
        </div>
        <Link to="/" variant="button">
          Go home
        </Link>
      </div>
    </div>
  );
}
