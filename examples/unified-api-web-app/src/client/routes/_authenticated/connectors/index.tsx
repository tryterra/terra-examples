import { CaretRightIcon } from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SearchField } from "@/client/components/shared/atoms/SearchField";
import { useFuzzySearch } from "@/client/hooks/useFuzzySearch";
import {
  ProviderGridList,
  type ProviderGridItem,
} from "@/client/components/pages/connectors/ProviderGridList";
import {
  useTerraAuthenticate,
  useTerraSync,
} from "@/client/hooks/useTerraMutations";
import {
  useTerraConnections,
  useTerraIntegrations,
} from "@/client/hooks/useTerraQueries";
import { formatRelativeTime } from "@/client/lib/format";

type ConnectorsSearch = {
  auth?: "success" | "failure";
};

export const Route = createFileRoute("/_authenticated/connectors/")({
  validateSearch: (search: Record<string, unknown>): ConnectorsSearch => ({
    auth:
      search.auth === "success" || search.auth === "failure"
        ? search.auth
        : undefined,
  }),
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const { auth } = Route.useSearch();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const terraSync = useTerraSync();
  const syncRef = useRef(terraSync.mutate);
  syncRef.current = terraSync.mutate;

  useEffect(() => {
    if (!auth) return;
    if (auth === "success") {
      syncRef.current(undefined, {
        onSettled: () => {
          navigate({ to: "/connectors", search: {}, replace: true });
        },
      });
    } else {
      navigate({ to: "/connectors", search: {}, replace: true });
    }
  }, [auth, navigate]);

  const { data: connectionsData, isLoading: loadingConnections } =
    useTerraConnections();

  const { data: integrationsData, isLoading: loadingIntegrations } =
    useTerraIntegrations();

  const connections = connectionsData?.connections ?? [];
  const providers = (integrationsData?.providers ?? []).filter(
    (p) => p.enabled,
  );
  const connectedProviders = new Set(
    connections
      .filter((c) => c.status === "active" || c.status === "error")
      .map((c) => c.provider),
  );
  const availableProviders = providers.filter(
    (p) => !connectedProviders.has(p.provider ?? ""),
  );
  const filtered = useFuzzySearch(availableProviders, search, ["name"]);
  const providerInfo = new Map(
    providers.map((p) => [p.provider, { icon: p.icon, name: p.name }]),
  );

  const authenticateMutation = useTerraAuthenticate("/connectors");

  const connectedItems: ProviderGridItem[] = connections.map((connection) => {
    const info = providerInfo.get(connection.provider);
    const name = info?.name ?? connection.provider;
    const isError = connection.status === "error";
    return {
      id: connection.id,
      icon: info?.icon,
      name,
      subtitle: (
        <span
          className={`text-sm ${isError ? "text-warning" : "text-subtle-text"}`}
        >
          {isError
            ? "Connection issue — please reconnect"
            : connection.lastWebhookAt
              ? `Synced: ${formatRelativeTime(connection.lastWebhookAt)}`
              : "No sync data yet"}
        </span>
      ),
      trailing: <CaretRightIcon size={20} className="text-subtle-text" />,
    };
  });

  const availableItems: ProviderGridItem[] = filtered.map((provider) => {
    const isConnecting =
      authenticateMutation.isPending &&
      authenticateMutation.variables === provider.provider;
    return {
      id: provider.provider ?? "",
      icon: provider.icon,
      name: provider.name ?? "",
      trailing: isConnecting ? (
        <span className="text-sm text-secondary-text">Opening...</span>
      ) : (
        <CaretRightIcon size={24} className="text-subtle-text" />
      ),
    };
  });

  return (
    <div className="flex items-start justify-center px-4 py-32">
      <div className="flex w-full max-w-2xl flex-col gap-16">
        {/* --- Header --- */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold leading-none text-main-black">
            Connectors
          </h1>
          <p className="text-base text-secondary-text">
            Add and manage your connected health sources
          </p>
        </div>

        {/* --- Connected --- */}
        <div className="flex flex-col gap-8">
          <h2 className="text-lg font-semibold leading-none text-main-black">
            Connected
          </h2>
          <ProviderGridList
            items={connectedItems}
            label="Connected health sources"
            onAction={(key) =>
              navigate({
                to: "/connectors/$connectionId",
                params: { connectionId: key as string },
              })
            }
            isLoading={loadingConnections}
            emptyMessage="No connected sources"
          />
        </div>

        {/* --- Not connected --- */}
        <div className="flex flex-col gap-8">
          <h2 className="text-lg font-semibold leading-none text-main-black">
            Not connected
          </h2>
          <SearchField
            aria-label="Search connectors"
            placeholder="Search..."
            value={search}
            onChange={setSearch}
          />
          <ProviderGridList
            items={availableItems}
            label="Available health sources"
            onAction={(key) => authenticateMutation.mutate(key as string)}
            isLoading={loadingIntegrations}
            skeletonCount={5}
            disabledKeys={
              authenticateMutation.isPending && authenticateMutation.variables
                ? [authenticateMutation.variables]
                : []
            }
          />
        </div>
      </div>
    </div>
  );
}
