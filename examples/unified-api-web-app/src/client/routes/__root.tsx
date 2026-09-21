import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/client/lib/query-client";
import { NotFoundPage } from "@/client/components/shared/molecules/NotFoundPage";
import { GlobalToastRegion } from "@/client/components/shared/atoms/Toast";
import "@/client/index.css";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <GlobalToastRegion />
    </QueryClientProvider>
  );
}
