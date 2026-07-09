import { WarningIcon } from "@phosphor-icons/react";
import { Badge } from "@/client/components/shared/atoms/Badge";
import { formatRelativeTime } from "@/client/lib/format";

export function ConnectionStatusBadges({
  status,
  lastWebhookAt,
  connectedAt,
}: {
  status: string;
  lastWebhookAt?: string | null;
  connectedAt: string;
}) {
  const addedDate = new Date(connectedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <Badge variant={status === "error" ? "warning" : "emphasis"}>
        {status === "error" && <WarningIcon size={16} weight="bold" />}
        {status === "error" ? "Connection issue" : "Connected"}
      </Badge>

      <Badge variant="neutral">
        {lastWebhookAt
          ? `Last synced: ${formatRelativeTime(lastWebhookAt)}`
          : "No sync data yet"}
      </Badge>

      <Badge variant="neutral">Added {addedDate}</Badge>
    </>
  );
}
