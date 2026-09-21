import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { authClient } from "@/client/lib/auth-client";
import { NotFoundPage } from "@/client/components/shared/molecules/NotFoundPage";
import { Sidebar } from "@/client/components/shared/molecules/Sidebar";
import { MobileNavbar } from "@/client/components/shared/molecules/MobileNavbar";
import { Navbar } from "@/client/components/shared/molecules/Navbar";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session?.user) throw redirect({ to: "/login" });

    const { onboardingStep } = session.user;
    const isOnboarding = location.pathname.startsWith("/onboarding");

    if (isOnboarding && onboardingStep === "completed") {
      throw redirect({ to: "/dashboard" });
    }

    if (!isOnboarding) {
      if (onboardingStep === "profile")
        throw redirect({ to: "/onboarding/profile" });
      if (onboardingStep === "connect")
        throw redirect({ to: "/onboarding/connect" });
    }

    return { user: session.user, session: session.session };
  },
  component: AuthenticatedLayout,
  notFoundComponent: (props) => <NotFoundPage {...props} className="h-full" />,
});

function AuthenticatedLayout() {
  const location = useLocation();
  const isOnboarding = location.pathname.startsWith("/onboarding");

  if (isOnboarding) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-auto">
        <Navbar />
        <main className="flex-1 overflow-auto pb-18 md:pb-0">
          <Outlet />
        </main>
      </div>
      <MobileNavbar />
    </div>
  );
}
