import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppleLogoIcon,
  ArrowsClockwiseIcon,
  CaretLeftIcon,
} from "@phosphor-icons/react";
import { RecordDrawer } from "../../components/records/RecordDrawer";
import { RecordSection } from "../../components/records/RecordSection";
import { Badge } from "../../components/shared/atoms/Badge";
import { Button } from "../../components/shared/atoms/Button";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { toastQueue } from "../../components/shared/atoms/Toast";
import { Meta, MetaRow } from "../../components/shared/Meta";
import { api, unwrap } from "../../lib/api";
import { compareTypes, typeMeta } from "../../lib/clinical-types";
import { formatRelativeTime, joinNames } from "../../lib/format";
import {
  healthQuery,
  userRecordsQuery,
  type RecordItem,
} from "../../lib/queries";
import { groupRecords } from "../../lib/record-rows";

export const Route = createFileRoute("/users/$userId")({
  // `?record=<record_id>` opens that record's detail drawer, so a record is
  // linkable and the back button closes the drawer.
  validateSearch: (search: Record<string, unknown>): { record?: string } =>
    typeof search.record === "string" ? { record: search.record } : {},
  component: UserDashboard,
});

const PROVIDER_LABELS: Record<string, string> = { APPLE: "Apple Health" };

function UserDashboard() {
  const { userId } = Route.useParams();
  const { record: openId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
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
  const sections = useMemo(() => {
    const byType = new Map<string, RecordItem[]>();
    for (const item of records) {
      const t = item.record.clinical_type;
      byType.set(t, [...(byType.get(t) ?? []), item]);
    }
    return [...byType.entries()]
      .sort(([a], [b]) => compareTypes(a, b))
      .map(([type, items]) => ({ type, groups: groupRecords(items) }));
  }, [records]);
  const sources = useMemo(
    () => [...new Set(records.map((r) => r.record.source_name))].sort(),
    [records],
  );
  const openItem = openId
    ? records.find((r) => r.record.record_id === openId)
    : undefined;

  const setOpen = (record: string | undefined) =>
    navigate({ search: record ? { record } : {}, resetScroll: false });

  const provider = user
    ? (PROVIDER_LABELS[user.provider] ?? user.provider)
    : null;

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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-3">
              <h1 className="truncate text-3xl font-semibold text-main-black">
                {user.referenceId ?? user.userId}
              </h1>
              <MetaRow>
                <Meta label="User ID" mono>
                  {user.userId}
                </Meta>
                <Meta label="Last synced">
                  {user.lastSyncedAt
                    ? formatRelativeTime(user.lastSyncedAt)
                    : "Never"}
                </Meta>
                <Meta label="Last webhook">
                  {user.lastWebhookAt
                    ? formatRelativeTime(user.lastWebhookAt)
                    : "None yet"}
                </Meta>
              </MetaRow>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {provider && (
                <Badge variant="emphasis" className="whitespace-nowrap">
                  {user.provider === "APPLE" && (
                    <AppleLogoIcon size={14} weight="fill" />
                  )}
                  {provider}
                </Badge>
              )}
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
          </div>
        )}
        {records.length > 0 && (
          <p className="text-sm text-secondary-text">
            {records.length} records from {joinNames(sources)}
          </p>
        )}
        {user?.lastSyncError && (
          <p className="text-sm text-warning">
            Last sync failed: {user.lastSyncError}
          </p>
        )}
      </header>

      {recordsQ.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : recordsQ.isError ? (
        <p className="text-sm text-subtle-text">{recordsQ.error.message}</p>
      ) : records.length === 0 ? (
        <section className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-main-black">
            No clinical records yet
          </h2>
          <p className="max-w-2xl text-sm text-subtle-text">
            Records appear once the user shares Health Records from Apple Health
            and CLINICAL_RECORD is enabled for your dev ID. New records are held
            back for about a minute before the pull API returns them.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-10">
          {sections.map(({ type, groups }, i) => (
            <RecordSection
              key={type}
              type={type}
              title={typeMeta(type).label}
              groups={groups}
              onOpen={setOpen}
              first={i === 0}
            />
          ))}
        </div>
      )}

      <RecordDrawer item={openItem} onClose={() => setOpen(undefined)} />
    </div>
  );
}
