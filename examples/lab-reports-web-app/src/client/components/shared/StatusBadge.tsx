/**
 * The one status→badge mapping for lab report session lifecycles. Only three
 * badge variants exist by design (emphasis/warning/neutral); critical
 * escalation uses the banner, never a badge. Statuses are open enums —
 * unknown values fall through to neutral.
 */
import { Badge } from "./atoms/Badge";
import { twMerge } from "tailwind-merge";

const EMPHASIS = new Set(["standardized", "sending", "sent", "partially_sent"]);
const WARNING = new Set(["failed", "cancelled", "deleted"]);

export function statusVariant(
  status: string,
): "emphasis" | "warning" | "neutral" {
  if (EMPHASIS.has(status)) return "emphasis";
  if (WARNING.has(status)) return "warning";
  return "neutral";
}

/** Raw lifecycle enums are identifiers — render monospace so they scan. */
export function StatusBadge({
  status,
  mono = true,
  className,
}: {
  status: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant={statusVariant(status)}
      className={twMerge(mono && "font-mono text-xs", className)}
    >
      {status}
    </Badge>
  );
}

/** Human labels for the upload progress timeline. */
export const LAB_STATUS_LABELS: Record<string, string> = {
  processing: "Reading the report",
  processed: "Report read",
  standardizing: "Standardizing biomarkers",
  standardized: "Results ready",
  sending: "Results ready",
  sent: "Results ready",
  partially_sent: "Results ready",
  retry_scheduled: "Retrying shortly",
  retrying: "Retrying",
  failed: "Processing failed",
  cancelled: "Cancelled",
};

export function labStatusLabel(status: string): string {
  return LAB_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}
