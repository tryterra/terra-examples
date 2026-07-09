import { CaretRightIcon } from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/client/components/shared/atoms/Button";
import {
  GridList,
  GridListItem,
} from "@/client/components/shared/atoms/GridList";
import { ProviderIcon } from "@/client/components/shared/atoms/ProviderIcon";
import { SearchField } from "@/client/components/shared/atoms/SearchField";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import {
  useTerraAuthenticate,
  useTerraSync,
} from "@/client/hooks/useTerraMutations";
import {
  terraIntegrationsQueryOpts,
  useTerraIntegrations,
} from "@/client/hooks/useTerraQueries";
import { api } from "@/client/lib/api";
import { authClient } from "@/client/lib/auth-client";
import { queryClient } from "@/client/lib/query-client";

type ConnectSearch = {
  auth?: "success" | "failure";
};

export const Route = createFileRoute("/_authenticated/onboarding/connect")({
  validateSearch: (search: Record<string, unknown>): ConnectSearch => ({
    auth:
      search.auth === "success" || search.auth === "failure"
        ? search.auth
        : undefined,
  }),
  component: ConnectPage,
  loader: () => {
    queryClient.prefetchQuery(terraIntegrationsQueryOpts);
  },
});

function ConnectPage() {
  const { auth } = Route.useSearch();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const terraSync = useTerraSync();
  const syncRef = useRef(terraSync.mutate);
  syncRef.current = terraSync.mutate;

  useEffect(() => {
    if (!auth) return;
    if (auth === "success") {
      syncRef.current(undefined, {
        onSuccess: async () => {
          const res = await api.api.onboarding.complete.$post();
          if (res.ok) {
            await authClient.getSession({
              query: { disableCookieCache: true },
            });
            navigate({ to: "/dashboard", replace: true });
          } else {
            navigate({ to: "/onboarding/connect", search: {}, replace: true });
          }
        },
        onError: () => {
          navigate({ to: "/onboarding/connect", search: {}, replace: true });
        },
      });
    } else {
      navigate({ to: "/onboarding/connect", search: {}, replace: true });
    }
  }, [auth, navigate]);

  const { data: integrationsData, isLoading: loadingIntegrations } =
    useTerraIntegrations();

  const authenticateMutation = useTerraAuthenticate("/onboarding/connect");

  const providers = (integrationsData?.providers ?? []).filter(
    (p) => p.enabled,
  );
  const filtered = providers.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleSkip() {
    setIsSubmitting(true);
    try {
      const res = await api.api.onboarding.complete.$post();
      if (res.ok) {
        await authClient.getSession({
          query: { disableCookieCache: true },
        });
        navigate({ to: "/dashboard" });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg-grey px-4 py-32">
      <div className="flex w-full max-w-2xl flex-col gap-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold leading-none text-main-black">
            Add a health connector
          </h1>
          <p className="text-base text-secondary-text">
            Connect your preferred health tracker to see all your vitals in one
            place.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          <SearchField
            aria-label="Search connectors"
            placeholder="Search..."
            value={search}
            onChange={setSearch}
          />
          {loadingIntegrations ? (
            <div className="flex flex-col">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-border py-4"
                >
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : (
            <GridList
              aria-label="Available health sources"
              onAction={(key) => authenticateMutation.mutate(key as string)}
              disabledKeys={
                authenticateMutation.isPending && authenticateMutation.variables
                  ? [authenticateMutation.variables]
                  : []
              }
            >
              {filtered.map((provider) => {
                const isConnecting =
                  authenticateMutation.isPending &&
                  authenticateMutation.variables === provider.provider;
                return (
                  <GridListItem
                    key={provider.provider}
                    id={provider.provider ?? undefined}
                    textValue={provider.name ?? ""}
                  >
                    <ProviderIcon icon={provider.icon} name={provider.name} />
                    <span className="flex-1 text-base font-medium text-main-black">
                      {provider.name}
                    </span>
                    {isConnecting ? (
                      <span className="text-sm text-secondary-text">
                        Opening...
                      </span>
                    ) : (
                      <CaretRightIcon size={24} className="text-subtle-text" />
                    )}
                  </GridListItem>
                );
              })}
            </GridList>
          )}
        </div>

        <Button onPress={handleSkip} isPending={isSubmitting} variant="quiet">
          Skip for now
        </Button>
      </div>
    </main>
  );
}
