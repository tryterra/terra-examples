import { CloudCheckIcon, LockIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/client/components/shared/atoms/Button";
import { ProviderIcon } from "@/client/components/shared/atoms/ProviderIcon";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import { ConnectionStatusBadges } from "@/client/components/pages/connectors/ConnectionStatusBadges";
import { DetailCard } from "@/client/components/pages/connectors/DetailCard";
import { DisconnectModal } from "@/client/components/pages/connectors/DisconnectModal";
import { useTerraReconnect } from "@/client/hooks/useTerraMutations";
import {
  terraConnectionQueryOpts,
  terraIntegrationsQueryOpts,
  useTerraConnection,
  useTerraIntegrations,
} from "@/client/hooks/useTerraQueries";
import { formatRelativeTime } from "@/client/lib/format";
import { queryClient } from "@/client/lib/query-client";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function formatEventType(type: string): string {
  return type
    .replace(/^[a-z]+:\/\//, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .split("/")
    .pop()!;
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

function ConnectionDetailPage() {
  const { connectionId } = Route.useParams();
  const [showAllScopes, setShowAllScopes] = useState(false);
  const [eventsOffset, setEventsOffset] = useState(0);
  const [allEvents, setAllEvents] = useState<
    Array<{ eventType: string; createdAt: string }>
  >([]);

  const {
    data,
    isPending: connectionPending,
    isFetching: eventsFetching,
  } = useTerraConnection(connectionId, eventsOffset);
  const { data: integrationsData, isPending: integrationsPending } =
    useTerraIntegrations();
  const reconnectMutation = useTerraReconnect("/connectors");

  useEffect(() => {
    if (!data?.webhookEvents) return;
    if (eventsOffset === 0) {
      setAllEvents(data.webhookEvents);
    } else {
      setAllEvents((prev) => [...prev, ...data.webhookEvents]);
    }
  }, [data?.webhookEvents, eventsOffset]);

  const connection = data?.connection;
  const latestBatchSize = data?.webhookEvents?.length ?? 0;

  const provider = integrationsData?.providers?.find(
    (p) => p.provider === connection?.provider,
  );
  const headerPending = connectionPending || integrationsPending;
  const providerName = provider?.name ?? connection?.provider ?? "";
  const scopes = (connection?.scopes as string[] | null) ?? [];

  return (
    <div className="flex items-start justify-center px-4 py-32">
      <div className="flex w-full max-w-2xl flex-col gap-16">
        {/* --- Header --- */}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-6">
              {headerPending ? (
                <>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-9 w-40" />
                </>
              ) : (
                <>
                  <ProviderIcon icon={provider?.icon} name={providerName} />
                  <h1 className="text-4xl font-semibold leading-none text-main-black">
                    {providerName}
                  </h1>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {headerPending ? (
                <>
                  <Skeleton className="h-7 w-24 rounded-md" />
                  <Skeleton className="h-7 w-40 rounded-md" />
                  <Skeleton className="h-7 w-28 rounded-md" />
                </>
              ) : (
                <ConnectionStatusBadges
                  status={connection!.status}
                  lastWebhookAt={connection?.lastWebhookAt}
                  connectedAt={connection!.connectedAt}
                />
              )}
            </div>
          </div>
          {headerPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : connection?.status === "error" ? (
            <div className="flex flex-col gap-8">
              <p className="text-base text-secondary-text">
                Your {providerName} connection may have been revoked or
                experienced a temporary issue. Your existing data is preserved,
                but new data won&apos;t sync until you reconnect.
              </p>
              <Button
                variant="primary"
                className="w-full"
                isPending={reconnectMutation.isPending}
                onPress={() => {
                  if (!connection?.provider) return;
                  reconnectMutation.mutate({
                    connectionId,
                    resource: connection.provider,
                  });
                }}
              >
                Reconnect {providerName}
              </Button>
            </div>
          ) : (
            <p className="text-base text-secondary-text">
              Your {providerName} account is connected to Terra. Your data is
              automatically synced and available from your dashboard.
            </p>
          )}
        </div>

        {/* --- Info grid --- */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard
            icon={<LockIcon size={16} className="text-emphasis" />}
            title="Enabled scopes"
            isLoading={connectionPending}
            showMore={
              scopes.length > 5 && !showAllScopes
                ? { visible: true, onPress: () => setShowAllScopes(true) }
                : undefined
            }
          >
            {scopes.length === 0 ? (
              <p className="py-3 text-base text-subtle-text">
                No scopes available
              </p>
            ) : (
              (showAllScopes ? scopes : scopes.slice(0, 5)).map(
                (scope, i, visible) => (
                  <div
                    key={scope}
                    className={`py-3 text-base text-main-black ${i < visible.length - 1 ? "border-b border-border" : ""}`}
                  >
                    {scope}
                  </div>
                ),
              )
            )}
          </DetailCard>

          <DetailCard
            icon={<CloudCheckIcon size={16} className="text-emphasis" />}
            title="Recent sync events"
            isLoading={connectionPending}
            skeletonRow={
              <div className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            }
            showMore={
              latestBatchSize >= 5
                ? {
                    visible: true,
                    isPending: eventsFetching && eventsOffset > 0,
                    onPress: () => setEventsOffset((o) => o + 5),
                  }
                : undefined
            }
          >
            {allEvents.length === 0 ? (
              <p className="py-3 text-base text-subtle-text">
                No sync events yet
              </p>
            ) : (
              allEvents.map((event, i) => (
                <div
                  key={`${event.eventType}-${event.createdAt}-${i}`}
                  className={`grid grid-cols-[1fr_2fr] py-3 text-base ${i < allEvents.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="font-medium capitalize text-main-black">
                    {formatEventType(event.eventType)}
                  </span>
                  <span className="text-secondary-text">
                    {formatRelativeTime(event.createdAt)}
                  </span>
                </div>
              ))
            )}
          </DetailCard>
        </div>

        {/* --- Danger zone --- */}
        <div className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold leading-none text-main-black">
              Danger zone
            </h2>
            <p className="text-base text-secondary-text">
              This action is irreversible. Your connection and its associated
              data will be deleted.
            </p>
          </div>
          {connectionPending ? (
            <Skeleton className="h-12 w-full rounded-full" />
          ) : (
            <DisconnectModal
              providerName={providerName}
              connectionId={connectionId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Route export ------------------------------ */

export const Route = createFileRoute(
  "/_authenticated/connectors/$connectionId",
)({
  component: ConnectionDetailPage,
  loader: ({ params }) => {
    queryClient.prefetchQuery(terraConnectionQueryOpts(params.connectionId));
    queryClient.prefetchQuery(terraIntegrationsQueryOpts);
  },
});
