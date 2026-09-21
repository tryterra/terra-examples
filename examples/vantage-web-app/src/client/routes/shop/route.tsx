import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Storefront shell: one centered column shared by every /shop page. */
export const Route = createFileRoute("/shop")({
  component: () => (
    <div className="flex items-start justify-center px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <Outlet />
      </div>
    </div>
  ),
});
