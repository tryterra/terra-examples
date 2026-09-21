import { useLayoutEffect, useRef } from "react";
import {
  createRootRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SparkleIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { GlobalToastRegion } from "../components/shared/atoms/Toast";
import { healthQuery } from "../lib/queries";

export const Route = createRootRoute({ component: RootLayout });

/**
 * Per-page scroll restoration, keyed by pathname. The router's built-in
 * restoration only fires on browser back/forward (history pops); this app's
 * back navigation is mostly in-app links (pushes), so we track and restore
 * the scrolling <main> ourselves for every visit to a path.
 */
const scrollPositions = new Map<string, number>();

function useMainScrollRestoration(pathname: string) {
  const mainRef = useRef<HTMLElement>(null);
  const restoringRef = useRef(false);

  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const target = scrollPositions.get(pathname) ?? 0;
    restoringRef.current = true;
    el.scrollTop = target;
    // Data often streams in after the first paint, so the page may not be
    // tall enough yet — keep nudging for a few frames until it sticks.
    const start = performance.now();
    let raf = requestAnimationFrame(function tick() {
      if (
        Math.abs(el.scrollTop - target) < 2 ||
        performance.now() - start > 800
      ) {
        restoringRef.current = false;
        return;
      }
      el.scrollTop = target;
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      restoringRef.current = false;
    };
  }, [pathname]);

  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    // Ignore programmatic scrolls during restore — a clamped intermediate
    // value must not overwrite the saved position.
    if (restoringRef.current) return;
    scrollPositions.set(pathname, e.currentTarget.scrollTop);
  };

  return { mainRef, onScroll };
}

/** Amber strip shown when the server runs without Terra credentials. */
function DemoBanner() {
  const healthQ = useQuery(healthQuery);
  if (!healthQ.data?.demo) return null;
  return (
    <div className="flex items-center gap-2 border-b border-warning bg-warning-bg px-4 py-1.5 text-xs font-medium text-warning">
      <SparkleIcon size={14} weight="bold" />
      Demo mode: showing bundled sample data. Add Terra API credentials in
      .env to go live.
    </div>
  );
}

function RootLayout() {
  // The RESOLVED pathname only changes once the new page's content has
  // committed — restoring on the raw location would scroll the old page
  // (still on screen while the route loads) and flash.
  const pathname = useRouterState({
    select: (s) => s.resolvedLocation?.pathname ?? s.location.pathname,
  });
  const { mainRef, onScroll } = useMainScrollRestoration(pathname);
  return (
    // h-screen (not min-h): the sidebar stays pinned to the viewport while
    // <main> scrolls independently.
    <div className="flex h-screen">
      <aside className="flex w-18 shrink-0 flex-col items-center border-r border-border bg-white py-4">
        <div className="flex size-10 items-center justify-center rounded-[10px] bg-main-black font-semibold text-white">
          T
        </div>
        <hr className="my-4 w-10 border-border" />
        <nav className="flex flex-col items-center gap-2">
          <Link
            to="/patients"
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium text-secondary-text hover:bg-hover-grey data-[status=active]:bg-emphasis-bg data-[status=active]:text-emphasis"
          >
            <UsersThreeIcon size={22} />
            Patients
          </Link>
        </nav>
        <span
          className="mt-auto font-mono text-[10px] tracking-wide uppercase text-subtle-text"
          style={{ writingMode: "vertical-rl" }}
        >
          terra demo
        </span>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <main ref={mainRef} onScroll={onScroll} className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <GlobalToastRegion />
    </div>
  );
}
