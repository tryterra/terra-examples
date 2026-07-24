import { useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  Link,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router";
import { GaugeIcon, StorefrontIcon } from "@phosphor-icons/react";
import { GlobalToastRegion } from "../components/shared/atoms/Toast";
import { configQuery } from "../lib/queries";

export const Route = createRootRoute({ component: RootLayout });

/** Persona is a function of the route prefix (/shop vs /ops) — no stored toggle. */
function RootLayout() {
  const matchRoute = useMatchRoute();
  const inOps = Boolean(matchRoute({ to: "/ops", fuzzy: true }));
  const { data: config } = useQuery(configQuery);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-18 flex-col items-center border-r border-border bg-white py-4">
        <div className="flex size-10 items-center justify-center rounded-[10px] bg-main-black font-semibold text-white">
          T
        </div>
        <hr className="my-4 w-10 border-border" />
        <nav className="flex flex-col items-center gap-2">
          <SidebarLink to="/shop" label="Shop" active={!inOps}>
            <StorefrontIcon size={22} weight={!inOps ? "bold" : "regular"} />
          </SidebarLink>
          <SidebarLink to="/ops" label="Ops" active={inOps}>
            <GaugeIcon size={22} weight={inOps ? "bold" : "regular"} />
          </SidebarLink>
        </nav>
        <span
          className={`mt-auto font-mono text-[10px] tracking-wide uppercase ${
            config?.demoMode ? "text-warning" : "text-subtle-text"
          }`}
          style={{ writingMode: "vertical-rl" }}
        >
          {config?.demoMode ? "demo" : "sandbox"}
        </span>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {config?.demoMode && (
          <div className="flex items-center justify-center gap-2 border-b border-warning bg-warning-bg px-4 py-2 text-sm font-medium text-warning">
            Demo data — add sandbox credentials to .env to go live.
          </div>
        )}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <GlobalToastRegion />
    </div>
  );
}

function SidebarLink({
  to,
  label,
  active,
  children,
}: {
  to: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium ${
        active
          ? "bg-emphasis-bg text-emphasis"
          : "text-secondary-text hover:bg-hover-grey"
      }`}
    >
      {children}
      {label}
    </Link>
  );
}
