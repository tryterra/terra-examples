import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CaretRightIcon } from "@phosphor-icons/react";
import { opsOrdersQuery, opsResultsQuery } from "../../lib/queries";
import type { OrdersOk, ResultsOk } from "../../components/pages/ops/api-types";
import { formatRelativeTime } from "../../lib/format";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { GridList, GridListItem } from "../../components/shared/atoms/GridList";
import { Skeleton } from "../../components/shared/atoms/Skeleton";

export const Route = createFileRoute("/ops/results")({
  component: ResultsQueue,
});

function ResultsQueue() {
  const navigate = useNavigate();
  const awaitingQ = useQuery(opsOrdersQuery({ missing: true }));
  const awaiting = (awaitingQ.data as OrdersOk | undefined)?.orders ?? [];
  // Ready-but-unacknowledged, straight from the Vantage results index.
  // Ready-to-acknowledge spans results_ready AND escalation_raised (a later
  // ready state); filter client-side rather than by a single server status.
  const resultsQ = useQuery(opsResultsQuery());
  const READY = new Set([
    "results.results_ready",
    "results.partial_results_ready",
    "results.escalation_raised",
  ]);
  const ready = (
    (resultsQ.data as ResultsOk | undefined)?.results ?? []
  ).filter((r) => READY.has(r.results_status ?? "") && !r.is_acknowledged);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold text-main-black">Results queue</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-main-black">
          Awaiting results
        </h2>
        {awaitingQ.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : awaiting.length === 0 ? (
          <p className="text-sm text-subtle-text">
            No orders are awaiting results.
          </p>
        ) : (
          <GridList
            aria-label="Orders awaiting results"
            onAction={(key) =>
              navigate({
                to: "/ops/orders/$orderId",
                params: { orderId: String(key) },
              })
            }
          >
            {awaiting.map((o) => (
              <GridListItem
                key={o.order_id}
                id={o.order_id}
                textValue={o.client_order_reference_id ?? o.order_id}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium text-main-black">
                    {o.client_order_reference_id ?? o.order_id}
                  </span>
                  <span className="font-mono text-xs text-subtle-text">
                    {o.order_id}
                  </span>
                </div>
                <StatusBadge
                  status={o.items[0]?.results_status ?? o.order_status}
                />
                <CaretRightIcon size={20} className="text-subtle-text" />
              </GridListItem>
            ))}
          </GridList>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-main-black">
          Ready to acknowledge
        </h2>
        {resultsQ.isLoading ? (
          <Skeleton className="h-14" />
        ) : ready.length === 0 ? (
          <p className="text-sm text-subtle-text">
            Nothing ready to acknowledge yet.
          </p>
        ) : (
          <GridList
            aria-label="Results ready to acknowledge"
            // Cross-persona hand-off to the storefront result view — plain
            // window navigation keeps this decoupled from the /shop route tree.
            onAction={(key) => {
              window.location.href = `/shop/kits/${String(key)}/result`;
            }}
          >
            {ready.map((r) => (
              <GridListItem
                key={r.order_item_id}
                id={r.order_item_id}
                textValue={r.product_name ?? "Test kit"}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-main-black">
                    {r.product_name ?? "Test kit"}
                  </span>
                  <span className="font-mono text-xs text-subtle-text">
                    {r.order_item_id} · updated{" "}
                    {formatRelativeTime(r.updated_at)}
                  </span>
                </div>
                <StatusBadge status={r.results_status} />
                <CaretRightIcon size={20} className="text-subtle-text" />
              </GridListItem>
            ))}
          </GridList>
        )}
      </section>
    </div>
  );
}
