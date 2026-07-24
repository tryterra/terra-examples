import { createFileRoute } from "@tanstack/react-router";
import { Link as AtomLink } from "../../components/shared/atoms/Link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { DialogTrigger } from "react-aria-components";
import { api, unwrap } from "../../lib/api";
import { configQuery, opsOrderQuery } from "../../lib/queries";
import type { OrderDetailOk } from "../../components/pages/ops/api-types";
import {
  formatDateTime,
  formatPrice,
  formatRelativeTime,
} from "../../lib/format";
import {
  StatusBadge,
  statusVariant,
} from "../../components/shared/StatusBadge";
import { Timeline, type TimelineEvent } from "../../components/shared/Timeline";
import { Button } from "../../components/shared/atoms/Button";
import { Modal } from "../../components/shared/atoms/Modal";
import { Dialog, Heading } from "../../components/shared/atoms/Dialog";
import { TextField } from "../../components/shared/atoms/TextField";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { toastQueue } from "../../components/shared/atoms/Toast";

export const Route = createFileRoute("/ops/orders/$orderId")({
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { data, isLoading } = useQuery(opsOrderQuery(orderId));
  const order = data as OrderDetailOk | undefined;
  const { data: config } = useQuery(configQuery);

  if (isLoading || !order) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const lastChange = order.status_history?.[0]?.changed_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <AtomLink
          to="/ops/orders"
          variant="button-quiet"
          className="w-fit gap-1 text-sm"
        >
          <ArrowLeftIcon size={14} /> Orders
        </AtomLink>
        <h1 className="text-3xl font-semibold text-main-black">
          {order.client_order_reference_id || order.order_id}
        </h1>
        <span className="font-mono text-sm text-subtle-text">
          {order.order_id}
        </span>
        <div className="flex items-center gap-3">
          {order.order_status && <StatusBadge status={order.order_status} />}
          {lastChange && (
            <span className="text-sm text-subtle-text">
              Updated {formatRelativeTime(lastChange)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <RecipientCard order={order} />
          {order.items.map((item) => (
            <ItemCard key={item.order_item_id} item={item} />
          ))}
          <TimelineCard history={order.status_history ?? []} />
        </div>

        <div className="flex flex-col gap-4">
          {/* Simulate is sandbox-only — production returns 403; the panel hides itself. */}
          {config?.sandbox && (
            <SimulatePanel
              orderId={orderId}
              order={order}
              events={config.simulateEvents}
            />
          )}
          <ActivateCard orderId={orderId} order={order} />
        </div>
      </div>
    </div>
  );
}

type Order = OrderDetailOk;

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
      <h2 className="text-sm font-medium text-secondary-text">{title}</h2>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-subtle-text">{label}</span>
      <span className="text-right text-main-black">{value ?? "—"}</span>
    </div>
  );
}

function RecipientCard({ order }: { order: Order }) {
  const r = order.recipient;
  const a = order.shipping_address;
  return (
    <Card title="Recipient">
      <div className="flex flex-col divide-y divide-border">
        <KV label="Name" value={`${r.first_name} ${r.last_name}`} />
        <KV label="Date of birth" value={r.date_of_birth} />
        <KV label="Sex at birth" value={r.gender_at_birth} />
        <KV label="Email" value={r.email} />
        <KV label="Phone" value={r.phone_number} />
        <KV
          label="Ship to"
          value={`${a.address_line_1}, ${a.city}, ${a.administrative_area} ${a.postal_code}, ${a.country_code}`}
        />
      </div>
    </Card>
  );
}

function ItemCard({ item }: { item: Order["items"][number] }) {
  return (
    <Card title="Item">
      <div className="flex flex-col divide-y divide-border">
        <KV
          label="Item ID"
          value={
            <span className="font-mono text-xs">{item.order_item_id}</span>
          }
        />
        <KV
          label="Variant"
          value={<span className="font-mono text-xs">{item.variant_id}</span>}
        />
        <KV
          label="Price"
          value={formatPrice(item.price_per_item_cents, item.currency)}
        />
        <KV
          label="Results"
          value={
            item.results_status ? (
              <StatusBadge status={item.results_status} />
            ) : (
              "—"
            )
          }
        />
        <KV
          label="Supplier item"
          value={
            item.supplier_item_id ? (
              <span className="font-mono text-xs">{item.supplier_item_id}</span>
            ) : (
              "—"
            )
          }
        />
        <KV
          label="Test takers"
          value={
            item.test_taker_ids?.length ? (
              <span className="font-mono text-xs">
                {item.test_taker_ids.join(", ")}
              </span>
            ) : (
              "none yet"
            )
          }
        />
      </div>
    </Card>
  );
}

function TimelineCard({
  history,
}: {
  history: NonNullable<Order["status_history"]>;
}) {
  // status_history is newest-first; Timeline renders forward-chronological.
  const events: TimelineEvent[] = [...history].reverse().map((h) => ({
    label: h.status,
    timestamp: h.changed_at,
    state: statusVariant(h.status) === "warning" ? "warning" : "done",
    detail: h.escalation_level
      ? `escalation_level: ${h.escalation_level}${h.acknowledgment_due_by ? ` · due ${formatDateTime(h.acknowledgment_due_by)}` : ""}`
      : undefined,
  }));
  return (
    <Card title="Timeline">
      {events.length === 0 ? (
        <p className="text-sm text-subtle-text">No history yet.</p>
      ) : (
        <Timeline events={events} />
      )}
    </Card>
  );
}

function SimulatePanel({
  orderId,
  order,
  events,
}: {
  orderId: string;
  order: Order;
  events: { order: readonly string[]; results: readonly string[] };
}) {
  const queryClient = useQueryClient();
  const firstItemId = order.items[0]?.order_item_id;

  const mutation = useMutation({
    mutationFn: ({ event, isResult }: { event: string; isResult: boolean }) =>
      api.api.ops.orders[":orderId"].simulate
        .$post({
          param: { orderId },
          json: {
            event: event as never,
            orderItemId: isResult ? firstItemId : undefined,
          },
        })
        .then((r) => unwrap<{ applied_event: string }>(r)),
    onSuccess: (res) => {
      toastQueue.add(
        { title: `Applied ${res.applied_event}`, variant: "default" },
        { timeout: 3000 },
      );
      queryClient.invalidateQueries({ queryKey: ["ops", "order", orderId] });
    },
    // 422 relays the API's actual reason verbatim — show it so the operator
    // sees exactly why the transition was rejected.
    onError: (err: Error) =>
      toastQueue.add(
        { title: "Event rejected", description: err.message, variant: "error" },
        { timeout: 6000 },
      ),
  });

  const group = (label: string, list: readonly string[], isResult: boolean) => (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-subtle-text">{label}</span>
      <div className="flex flex-wrap gap-2">
        {list.map((event) => (
          <Button
            key={event}
            variant="quiet"
            size="sm"
            isDisabled={mutation.isPending}
            onPress={() => mutation.mutate({ event, isResult })}
          >
            {event}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <Card title="Simulate">
      <p className="text-xs text-subtle-text">
        Applies a lifecycle event as a supplier update would — records history
        and delivers the signed webhook.
      </p>
      {group("Order events", events.order, false)}
      {group("Result events", events.results, true)}
    </Card>
  );
}

function ActivateCard({ orderId, order }: { orderId: string; order: Order }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const item = order.items.find(
    (i) => i.supplier_item_id && !i.test_taker_ids?.length,
  );
  const a = order.shipping_address;
  const [address, setAddress] = useState({
    address_line_1: a.address_line_1,
    address_line_2: a.address_line_2 ?? "",
    city: a.city,
    administrative_area: a.administrative_area,
    country_code: a.country_code,
    postal_code: a.postal_code,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.api.ops.orders[":orderId"].activate
        .$post({
          param: { orderId },
          json: {
            supplierKitId: item!.supplier_item_id!,
            address: {
              ...address,
              address_line_2: address.address_line_2 || undefined,
            },
          },
        })
        .then((r) => unwrap<{ success?: boolean; message?: string }>(r)),
    onSuccess: () => {
      toastQueue.add(
        { title: "Kit activated", variant: "default" },
        { timeout: 3000 },
      );
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ops", "order", orderId] });
    },
    onError: (err: Error & { status?: number }) =>
      toastQueue.add(
        {
          title:
            err.status === 409 ? "Kit already activated" : "Activation failed",
          description: err.status === 409 ? undefined : err.message,
          variant: "error",
        },
        { timeout: 6000 },
      ),
  });

  if (!item) return null;

  return (
    <Card title="Activate kit">
      <p className="text-xs text-subtle-text">
        This item has a supplier kit but no test taker yet. Activate it
        programmatically (the API alternative to the hosted QR page).
      </p>
      <span className="font-mono text-xs text-secondary-text">
        {item.supplier_item_id}
      </span>
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <Button variant="secondary" size="md">
          Activate kit
        </Button>
        <Modal isDismissable>
          <Dialog className="flex flex-col gap-4">
            <Heading slot="title">Activate kit</Heading>
            <div className="flex flex-col gap-3">
              {(
                [
                  ["address_line_1", "Address line 1"],
                  ["address_line_2", "Address line 2"],
                  ["city", "City"],
                  ["administrative_area", "Region"],
                  ["country_code", "Country code"],
                  ["postal_code", "Postal code"],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  value={address[key]}
                  onChange={(v) =>
                    setAddress((prev) => ({ ...prev, [key]: v }))
                  }
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="md"
                onPress={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isPending={mutation.isPending}
                onPress={() => mutation.mutate()}
              >
                Activate
              </Button>
            </div>
          </Dialog>
        </Modal>
      </DialogTrigger>
    </Card>
  );
}
