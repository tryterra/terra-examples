import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@/client/components/shared/atoms/Link";

export const Route = createFileRoute("/_public/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-grey px-4">
      <div className="flex w-full max-w-90 flex-col gap-12">
        <div className="flex flex-col gap-6 text-center text-main-black">
          <h1 className="text-4xl font-semibold leading-none">Welcome</h1>
          <p className="text-base text-secondary-text leading-normal">
            Check your latest scores, biomarkers, and activities. Dig deeper
            with AI.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <Link to="/register" variant="button" className="w-full">
            Sign up
          </Link>
          <p className="text-base">
            <span className="text-subtle-text">Already have an account? </span>
            <Link to="/login" variant="primary">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
