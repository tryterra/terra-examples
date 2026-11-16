import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwiseIcon, CaretLeftIcon } from "@phosphor-icons/react";
import { RecordCard } from "../../components/records/RecordCard";
import { Badge } from "../../components/shared/atoms/Badge";
import { Button } from "../../components/shared/atoms/Button";
import { EmptyState } from "../../components/shared/atoms/EmptyState";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { toastQueue } from "../../components/shared/atoms/Toast";
import { KpiCard } from "../../components/shared/KpiCard";
import { Meta, MetaRow } from "../../components/shared/Meta";
import { api, unwrap } from "../../lib/api";
import { compareTypes, typeMeta } from "../../lib/clinical-types";
import { formatRelativeTime } from "../../lib/format";
import {
  healthQuery,
  userRecordsQuery,
  type RecordItem,
} from "../../lib/queries";

export const Route = createFileRoute("/users/$userId")({
  component: UserDashboard,
});

function sectionId(type: string) {
  return `type-${type}`;
}

function UserDashboard() {
  const { userId } = Route.useParams();
  const recordsQ = useQuery(userRecordsQuery(userId));
  const healthQ = useQuery(healthQuery);
  const demo = healthQ.data?.demo === true;
  const queryClient = useQueryClient();

  const sync = useMutation({
    mutationFn: async () =>
      unwrap<{ sync: { records: number } }>(
        await api.api.users[":userId"].sync.$post({ param: { userId } }),
      ),
    onSuccess: async ({ sync }) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toastQueue.add({
        title:
          sync.records > 0
            ? `${sync.records} records synced`
            : "Up to date - no new records",
      });
    },
    onError: (err) => toastQueue.add({ title: err.message, variant: "error" }),
  });

  const user = recordsQ.data?.user;
  const records = useMemo(() => recordsQ.data?.records ?? [], [recordsQ.data]);
  const groups = useMemo(() => {
    const byType = new Map<string, RecordItem[]>();
    for (const item of records) {
      const t = item.record.clinical_type;
      byType.set(t, [...(byType.get(t) ?? []), item]);
    }
    return [...byType.entries()].sort(([a], [b]) => compareTypes(a, b));
  }, [records]);
  const sources = useMemo(
    () => [...new Set(records.map((r) => r.record.source_name))].sort(),
    [records],
  );
  const unavailable = records.filter(
    (r) => r.record.fhir_resource_error === "fhir_resource_unavailable",
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <Link
          to="/users"
          className="flex items-center gap-1 text-sm text-subtle-text hover:text-main-black"
        >
          <CaretLeftIcon size={14} /> Users
        </Link>
        {recordsQ.isLoading ? (
          <Skeleton className="h-12 w-80" />
        ) : !user ? null : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-3">
              <h1 className="truncate text-3xl font-semibold text-main-black">
                {user.referenceId ?? user.userId}
              </h1>
              <MetaRow>
                <Meta label="User ID" mono>
                  {user.userId}
                </Meta>
                <Meta label="Provider">{user.provider}</Meta>
                <Meta label="Last synced">
                  {formatRelativeTime(user.lastSyncedAt)}
                </Meta>
                <Meta label="Last webhook">
                  {formatRelativeTime(user.lastWebhookAt)}
                </Meta>
              </MetaRow>
            </div>
            <Button
              variant="secondary"
              onPress={() => sync.mutate()}
              isDisabled={demo || sync.isPending}
            >
              <ArrowsClockwiseIcon size={18} />
              {demo
                ? "Sync (needs credentials)"
                : sync.isPending
                  ? "Syncing…"
                  : "Sync now"}
            </Button>
          </div>
        )}
        {user?.lastSyncError && (
          <p className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
            Last sync failed: {user.lastSyncError}
          </p>
        )}
      </header>

      {recordsQ.isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        </div>
      ) : recordsQ.isError ? (
        <EmptyState>{recordsQ.error.message}</EmptyState>
      ) : records.length === 0 ? (
        <EmptyState>
          No clinical records yet. Records appear once the user shares Health
          Records from Apple Health and CLINICAL_RECORD is enabled for your dev
          ID. Newly received records are held back for about a minute before the
          pull API returns them.
        </EmptyState>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-secondary-text">
              <span>
                {records.length} records from {sources.length}{" "}
                {sources.length === 1 ? "health system" : "health systems"}:
              </span>
              {sources.map((s) => (
                <Badge key={s} variant="neutral">
                  {s}
                </Badge>
              ))}
              {unavailable > 0 && (
                <Badge variant="warning">
                  {unavailable} without FHIR content
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {groups.map(([type, items]) => {
                const meta = typeMeta(type);
                const flagged = items.filter(
                  (i) => i.summary.flag && i.summary.flag.tone !== "normal",
                ).length;
                return (
                  <KpiCard
                    key={type}
                    label={meta.label}
                    value={items.length}
                    sublabel={flagged > 0 ? `${flagged} flagged` : undefined}
                    onClick={() =>
                      document
                        .getElementById(sectionId(type))
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  />
                );
              })}
            </div>
          </section>

          {groups.map(([type, items]) => {
            const meta = typeMeta(type);
            const Icon = meta.icon;
            return (
              <section
                key={type}
                id={sectionId(type)}
                className="flex scroll-mt-6 flex-col gap-4"
              >
                <h2 className="flex items-center gap-2 text-xl font-semibold text-main-black">
                  <Icon size={22} className="text-emphasis" />
                  {meta.label}
                  <span className="text-base font-normal text-subtle-text">
                    {items.length}
                  </span>
                </h2>
                <div className="grid items-start gap-4 md:grid-cols-2">
                  {items.map((item) => (
                    <RecordCard key={item.record.record_id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
