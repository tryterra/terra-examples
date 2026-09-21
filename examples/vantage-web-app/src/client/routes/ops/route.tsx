import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/ops")({ component: OpsLayout });

const TABS = [
  { to: "/ops", label: "Overview", exact: true },
  { to: "/ops/orders", label: "Orders", exact: false },
  { to: "/ops/results", label: "Results queue", exact: false },
  { to: "/ops/webhooks", label: "Webhooks", exact: false },
  { to: "/ops/catalog", label: "Catalog", exact: false },
] as const;

function OpsLayout() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs tracking-wide text-subtle-text uppercase">
          Terra Dispatch console
        </span>
        <nav className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.exact }}
              className="-mb-px rounded-t-lg px-4 py-2.5 text-sm font-medium text-secondary-text transition hover:text-main-black"
              activeProps={{ className: "bg-emphasis-bg text-emphasis" }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
