import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/client/lib/auth-client";
import { api } from "@/client/lib/api";

async function getAuthenticatedRedirect(): Promise<string | null> {
  const { data: session } = await authClient.getSession();

  if (!session?.user) return null;

  const res = await api.api.onboarding.status.$get();
  if (!res.ok) return null;
  const { step } = await res.json();

  return step ? `/onboarding/${step}` : "/dashboard";
}

export const Route = createFileRoute("/_public")({
  beforeLoad: async () => {
    const redirectPath = await getAuthenticatedRedirect();
    if (redirectPath) {
      throw redirect({ to: redirectPath });
    }
  },
  component: () => <Outlet />,
});
