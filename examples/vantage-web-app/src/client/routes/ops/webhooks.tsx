import { createFileRoute } from "@tanstack/react-router";
import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, unwrap } from "../../lib/api";
import {
  deliveriesQuery,
  inboxQuery,
  webhookUrlQuery,
} from "../../lib/queries";
import type { DeliveriesOk } from "../../components/pages/ops/api-types";
import { formatRelativeTime } from "../../lib/format";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { JsonView } from "../../components/pages/ops/JsonView";
import { Button } from "../../components/shared/atoms/Button";
import { Modal } from "../../components/shared/atoms/Modal";
import { Dialog, Heading } from "../../components/shared/atoms/Dialog";
import { TextField } from "../../components/shared/atoms/TextField";
import { Select, SelectItem } from "../../components/shared/atoms/Select";
import { GridList, GridListItem } from "../../components/shared/atoms/GridList";
import { ToggleButton } from "../../components/shared/atoms/ToggleButton";
import { ToggleButtonGroup } from "../../components/shared/atoms/ToggleButtonGroup";
import { EmptyState } from "../../components/shared/atoms/EmptyState";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { toastQueue } from "../../components/shared/atoms/Toast";

export const Route = createFileRoute("/ops/webhooks")({ component: Webhooks });

function Webhooks() {
  const [tab, setTab] = useState<"inbox" | "outcomes">("inbox");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold text-main-black">Webhooks</h1>

      <RegisteredUrlCard />

      <div className="flex flex-col gap-2">
        <ToggleButtonGroup
          selectionMode="single"
          selectedKeys={[tab]}
          onSelectionChange={(k) =>
            k.size && setTab([...k][0] as "inbox" | "outcomes")
          }
          className="w-fit"
        >
          <ToggleButton id="inbox">Inbox</ToggleButton>
          <ToggleButton id="outcomes">Delivery outcomes</ToggleButton>
        </ToggleButtonGroup>
        <p className="text-xs text-subtle-text">
          Inbox is what our endpoint received; outcomes is what Vantage recorded
          about delivery.
        </p>
      </div>

      {tab === "inbox" ? <InboxPane /> : <OutcomesTable />}
    </div>
  );
}

function RegisteredUrlCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery(webhookUrlQuery);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const mutation = useMutation({
    mutationFn: (next: string) =>
      api.api.ops["webhook-url"]
        .$patch({ json: { url: next } })
        .then((r) => unwrap<{ webhook_url?: string }>(r)),
    onSuccess: () => {
      toastQueue.add(
        { title: "Webhook URL updated", variant: "default" },
        { timeout: 3000 },
      );
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ops", "webhook-url"] });
    },
    onError: (err: Error) =>
      toastQueue.add(
        {
          title: "Couldn't update URL",
          description: err.message,
          variant: "error",
        },
        { timeout: 6000 },
      ),
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-secondary-text">
          Registered webhook URL
        </h2>
        <Button
          variant="inline"
          onPress={() => {
            setUrl(data?.webhook_url ?? "");
            setOpen(true);
          }}
        >
          Change
        </Button>
      </div>
      <span className="break-all font-mono text-sm text-main-black">
        {data?.webhook_url || "Not registered"}
      </span>

      <Modal isOpen={open} onOpenChange={setOpen} isDismissable>
        <Dialog className="flex flex-col gap-4">
          <Heading slot="title">Change webhook URL</Heading>
          <TextField
            label="HTTPS URL"
            value={url}
            onChange={setUrl}
            placeholder="https://example.com/webhooks"
            type="url"
          />
          {url.trim() === "" && (
            <p className="text-sm text-warning">This stops webhook delivery.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="md"
              onPress={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={url.trim() === "" ? "destructive" : "primary"}
              size="md"
              isPending={mutation.isPending}
              onPress={() => mutation.mutate(url.trim())}
            >
              {url.trim() === "" ? "Stop delivery" : "Save"}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </section>
  );
}

function InboxPane() {
  const { data } = useQuery(inboxQuery);
  const events = data?.events ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((e) => e.eventId === selectedId) ?? events[0];

  if (events.length === 0) {
    return (
      <EmptyState>
        Waiting for your first webhook — run npm run webhook:tunnel
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[360px_1fr]">
      <div className="rounded-lg border border-border bg-white px-2">
        <GridList
          aria-label="Received webhooks"
          selectionMode="single"
          selectedKeys={selected ? [selected.eventId] : []}
          onSelectionChange={(k) =>
            k !== "all" && k.size && setSelectedId([...k][0] as string)
          }
        >
          {events.map((e) => (
            <GridListItem
              key={e.eventId}
              id={e.eventId}
              textValue={e.eventType}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-mono text-sm text-main-black">
                  {e.eventType}
                </span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  <span className="text-xs text-subtle-text">
                    {formatRelativeTime(e.receivedAt)}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs font-medium ${e.signatureValid ? "text-emphasis" : "text-warning"}`}
                  >
                    {e.signatureValid ? (
                      <CheckCircleIcon size={14} weight="bold" />
                    ) : (
                      <WarningIcon size={14} weight="bold" />
                    )}
                    {e.signatureValid ? "verified" : "invalid signature"}
                  </span>
                </div>
              </div>
            </GridListItem>
          ))}
        </GridList>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
        <h2 className="text-sm font-medium text-secondary-text">Payload</h2>
        {selected ? (
          <JsonView value={selected.payload} />
        ) : (
          <p className="text-sm text-subtle-text">Select an event.</p>
        )}
      </div>
    </div>
  );
}

const OUTCOMES = [
  "delivered",
  "rejected",
  "invalid",
  "dead_lettered",
  "replayed",
  "failed",
] as const;

function OutcomesTable() {
  const [outcome, setOutcome] = useState<string>("all");
  const { data, isLoading } = useQuery(
    deliveriesQuery(outcome === "all" ? undefined : outcome),
  );
  const deliveries = (data as DeliveriesOk | undefined)?.deliveries ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Select
        aria-label="Outcome filter"
        selectedKey={outcome}
        onSelectionChange={(k) => setOutcome(k as string)}
        className="min-w-[180px]"
      >
        <SelectItem id="all">All outcomes</SelectItem>
        {OUTCOMES.map((o) => (
          <SelectItem key={o} id={o}>
            {o}
          </SelectItem>
        ))}
      </Select>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="grid grid-cols-[200px_1fr_140px_80px_90px_120px] border-b border-border px-4 py-2.5 text-sm text-subtle-text">
          <span>Event ID</span>
          <span>Type</span>
          <span>Outcome</span>
          <span>Attempts</span>
          <span>Status</span>
          <span>Completed</span>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <p className="p-4 text-sm text-subtle-text">
            No deliveries for this outcome.
          </p>
        ) : (
          deliveries.map((d) => (
            <div
              key={d.event_id}
              className="grid grid-cols-[200px_1fr_140px_80px_90px_120px] items-center border-b border-border px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate pr-2 font-mono text-secondary-text">
                {d.event_id}
              </span>
              <span className="truncate pr-2 font-mono text-xs text-subtle-text">
                {d.event_type}
              </span>
              <span>
                <StatusBadge status={d.outcome} />
              </span>
              <span className="text-secondary-text">{d.attempts}</span>
              <span className="text-secondary-text">
                {d.final_status_code ?? "—"}
              </span>
              <span className="text-subtle-text">
                {formatRelativeTime(d.completed_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
