import {
  createFileRoute,
  Outlet,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { CaretRightIcon } from "@phosphor-icons/react";
import { api, unwrap } from "../../lib/api";
import type { OrdersOk } from "../../components/pages/ops/api-types";
import { formatRelativeTime } from "../../lib/format";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Badge } from "../../components/shared/atoms/Badge";
import { Button } from "../../components/shared/atoms/Button";
import { Select, SelectItem } from "../../components/shared/atoms/Select";
import { ToggleButton } from "../../components/shared/atoms/ToggleButton";
import { ToggleButtonGroup } from "../../components/shared/atoms/ToggleButtonGroup";
import { Skeleton } from "../../components/shared/atoms/Skeleton";

interface OrdersSearch {
  status?: string;
  missing?: boolean;
  collectionType?: "AT_HOME" | "GO_TO_LAB";
}

export const Route = createFileRoute("/ops/orders")({
  component: OrdersRoute,
  validateSearch: (s: Record<string, unknown>): OrdersSearch => ({
    status: typeof s.status === "string" ? s.status : undefined,
    missing: s.missing === true || s.missing === "true" ? true : undefined,
    collectionType:
      s.collectionType === "AT_HOME" || s.collectionType === "GO_TO_LAB"
        ? s.collectionType
        : undefined,
  }),
});

const STATUS_PILLS = [
  { key: "all", label: "All" },
  { key: "order.processing", label: "order.processing" },
  { key: "order.delivery_fulfilled", label: "order.delivery_fulfilled" },
  { key: "order.completed", label: "order.completed" },
  { key: "missing", label: "Missing results" },
] as const;

/** Parent of /ops/orders/$orderId — render only the detail when it's active. */
function OrdersRoute() {
  const matchRoute = useMatchRoute();
  if (matchRoute({ to: "/ops/orders/$orderId" })) return <Outlet />;
  return <OrdersTable />;
}

function OrdersTable() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const selectedPill = search.missing ? "missing" : (search.status ?? "all");

  const query = useInfiniteQuery({
    queryKey: ["ops", "orders", "infinite", search],
    queryFn: ({ pageParam }) =>
      api.api.ops.orders
        .$get({
          query: {
            cursor: pageParam,
            status: search.status,
            collectionType: search.collectionType,
            missing: search.missing ? "true" : undefined,
          },
        })
        .then((r) => unwrap<OrdersOk>(r)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  });

  const orders = query.data?.pages.flatMap((p) => p.orders) ?? [];

  function setPill(key: string) {
    navigate({
      to: "/ops/orders",
      search: {
        collectionType: search.collectionType,
        status: key === "all" || key === "missing" ? undefined : key,
        missing: key === "missing" ? true : undefined,
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold text-main-black">Orders</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleButtonGroup
          selectionMode="single"
          selectedKeys={[selectedPill]}
          onSelectionChange={(k) => k.size && setPill([...k][0] as string)}
        >
          {STATUS_PILLS.map((p) => (
            <ToggleButton
              key={p.key}
              id={p.key}
              className={
                p.key === "order.processing" ||
                p.key === "order.delivery_fulfilled" ||
                p.key === "order.completed"
                  ? "font-mono"
                  : undefined
              }
            >
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Select
          aria-label="Collection type"
          selectedKey={search.collectionType ?? "all"}
          onSelectionChange={(k) =>
            navigate({
              to: "/ops/orders",
              search: {
                ...search,
                collectionType:
                  k === "all" ? undefined : (k as "AT_HOME" | "GO_TO_LAB"),
              },
            })
          }
          className="min-w-[160px]"
        >
          <SelectItem id="all">All collection</SelectItem>
          <SelectItem id="AT_HOME">AT_HOME</SelectItem>
          <SelectItem id="GO_TO_LAB">GO_TO_LAB</SelectItem>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="grid grid-cols-[220px_180px_110px_230px_60px_1fr] border-b border-border px-4 py-2.5 text-sm text-subtle-text">
          <span>Order ID</span>
          <span>Reference</span>
          <span>Collection</span>
          <span>Status</span>
          <span>Items</span>
          <span>Updated</span>
        </div>

        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="p-4 text-sm text-subtle-text">
            No orders match this filter.
          </p>
        ) : (
          orders.map((o) => (
            <button
              key={o.order_id}
              type="button"
              onClick={() =>
                navigate({
                  to: "/ops/orders/$orderId",
                  params: { orderId: o.order_id },
                })
              }
              className="group grid w-full cursor-pointer grid-cols-[220px_180px_110px_230px_60px_1fr] items-center border-b border-border px-4 py-3.5 text-left last:border-0 hover:bg-black/2"
            >
              <span className="truncate pr-2 font-mono text-sm text-secondary-text">
                {o.order_id}
              </span>
              <span className="truncate pr-2 font-medium text-main-black">
                {o.client_order_reference_id ?? "—"}
              </span>
              <span>
                <Badge variant="neutral" className="font-mono text-xs">
                  {o.collection_type}
                </Badge>
              </span>
              <span>
                <StatusBadge status={o.order_status} />
              </span>
              <span className="text-sm text-secondary-text">
                {o.items.length}
              </span>
              <span className="flex items-center justify-between text-sm text-subtle-text">
                {formatRelativeTime(o.created_at)}
                <CaretRightIcon
                  size={16}
                  className="text-emphasis opacity-0 transition group-hover:opacity-100"
                />
              </span>
            </button>
          ))
        )}
      </div>

      {query.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            size="md"
            onPress={() => query.fetchNextPage()}
            isPending={query.isFetchingNextPage}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
