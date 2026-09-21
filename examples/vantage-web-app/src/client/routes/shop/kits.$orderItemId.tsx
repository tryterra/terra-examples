import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { Badge } from "@/client/components/shared/atoms/Badge";
import { ExternalLink } from "@/client/components/shared/atoms/Link";
import { Button } from "@/client/components/shared/atoms/Button";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import {
  Timeline,
  type TimelineEvent,
} from "@/client/components/shared/Timeline";
import {
  patientStatusLabel,
  statusVariant,
} from "@/client/components/shared/StatusBadge";
import { kitDisplayName } from "@/client/components/pages/shop/kit-name";
import {
  catalogTypesQuery,
  kitDetailQuery,
  type KitDetail,
} from "@/client/lib/queries";
import { formatRelativeTime } from "@/client/lib/format";

export const Route = createFileRoute("/shop/kits/$orderItemId")({
  component: KitDetailPage,
});

/** Success branch of the RPC type. The server's error responder widens the
 *  status type, so InferResponseType<…,200> leaks the error envelope in. */
type OkKitDetail = Exclude<KitDetail, { error: string }>;

/** The fulfilment ladder a kit still has ahead of it, in order. */
const FUTURE_STEPS = [
  "results.kit_activated",
  "results.sample_processing_in_lab",
  "results.results_ready",
] as const;

/** Real history (oldest-first) followed by the not-yet-reached ladder steps as pending. */
function buildTimeline(
  order: OkKitDetail["order"],
  orderItemId: string,
): TimelineEvent[] {
  const history = (order.status_history ?? []).filter(
    (h) => !h.order_item_id || h.order_item_id === orderItemId,
  );
  const seen = new Set(history.map((h) => h.status));
  const done: TimelineEvent[] = [...history].reverse().map((h) => ({
    label: patientStatusLabel(h.status),
    timestamp: h.changed_at,
    state: statusVariant(h.status) === "warning" ? "warning" : "done",
  }));
  const pending: TimelineEvent[] = FUTURE_STEPS.filter((s) => !seen.has(s)).map(
    (s) => ({
      label: patientStatusLabel(s),
      state: "pending",
    }),
  );
  return [...done, ...pending];
}

function KitDetailPage() {
  const { orderItemId } = Route.useParams();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const { data, isPending } = useQuery(kitDetailQuery(orderItemId));
  const { data: types } = useQuery(catalogTypesQuery);

  // The results screen nests under this route — render it through the Outlet.
  if (matchRoute({ to: "/shop/kits/$orderItemId/result" })) return <Outlet />;

  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { order, item, activationUrl } = data as OkKitDetail;
  const confirmedLab = (
    order as {
      confirmed_lab?: {
        name?: string;
        phone?: string;
        address?: {
          address_line_1?: string;
          city?: string;
          postal_code?: string;
        };
      };
    }
  ).confirmed_lab;
  const status = item?.results_status || order.order_status || "";
  const updatedAt = order.status_history?.[0]?.changed_at;
  const resultsReady = item?.results_status === "results.results_ready";
  const activated = Boolean(item?.test_taker_ids?.length);

  return (
    <>
      <h1 className="text-3xl font-semibold text-main-black">
        {kitDisplayName(item?.product_type_id, types)}
      </h1>

      <div className="flex flex-wrap items-center gap-2">
        {status && (
          <Badge variant={statusVariant(status)}>
            {patientStatusLabel(status)}
          </Badge>
        )}
        <Badge variant="neutral">Updated {formatRelativeTime(updatedAt)}</Badge>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        {item?.lab_tracking_number && (
          <KvRow label="Tracking number" value={item.lab_tracking_number} />
        )}
        {item?.supplier_item_id && (
          <KvRow label="Kit ID" value={item.supplier_item_id} />
        )}
        {activationUrl && !activated && (
          <div className="flex items-center justify-between gap-4 py-1">
            <span className="text-sm text-secondary-text">
              Activate your kit
            </span>
            <ExternalLink
              href={activationUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm"
            >
              Open activation page
            </ExternalLink>
          </div>
        )}
      </div>

      {confirmedLab && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-main-black">
            Your draw site
          </h2>
          <span className="text-sm font-medium text-main-black">
            {confirmedLab.name}
          </span>
          <span className="text-sm text-secondary-text">
            {[
              confirmedLab.address?.address_line_1,
              confirmedLab.address?.city,
              confirmedLab.address?.postal_code,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
          {confirmedLab.phone && (
            <span className="text-sm text-subtle-text">
              {confirmedLab.phone}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 rounded-xl border border-border bg-white p-5">
        <h2 className="text-lg font-semibold text-main-black">Progress</h2>
        <Timeline events={buildTimeline(order, orderItemId)} />
        {resultsReady && (
          <Button
            onPress={() =>
              navigate({
                to: "/shop/kits/$orderItemId/result",
                params: { orderItemId },
              })
            }
          >
            View results
          </Button>
        )}
      </div>
    </>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-secondary-text">{label}</span>
      <span className="font-mono text-sm text-main-black">{value}</span>
    </div>
  );
}
