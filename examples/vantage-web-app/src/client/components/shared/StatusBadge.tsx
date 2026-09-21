/**
 * The one status→badge mapping, shared by both personas. Only three badge
 * variants exist by design (emphasis/warning/neutral); critical escalation
 * uses the failure banner, never a badge.
 */
import { Badge } from "./atoms/Badge";
import { twMerge } from "tailwind-merge";

const EMPHASIS = new Set([
  "order.delivery_fulfilled",
  "order.completed",
  "order.payment_complete",
  // Transitional: older webhook payloads used a fulfillment.* prefix before
  // the vocabulary was unified on order.*; keep accepting stored payloads.
  "fulfillment.delivery_fulfilled",
  "fulfillment.completed",
  "fulfillment.payment_complete",
  "results.kit_activated",
  "results.results_ready",
  "acknowledged",
  "delivered",
]);
const WARNING = new Set([
  "order.delayed",
  "order.payment_failed",
  "order.failed", // legacy spelling of order.payment_failed
  "order.cancelled",
  "fulfillment.delayed",
  "fulfillment.payment_failed",
  "fulfillment.cancelled",
  "results.sample_rejected",
  "results.lab_processing_error",
  "results.escalation_raised",
  "rejected",
  "invalid",
  "dead_lettered",
]);

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

/** Human labels for patient-facing surfaces (never show raw enums there). */
export const PATIENT_STATUS_LABELS: Record<string, string> = {
  "order.payment_processing": "Payment processing",
  "order.payment_complete": "Payment received",
  "order.processing": "Preparing your kit",
  "order.delayed": "Slightly delayed",
  "order.delivery_fulfilled": "Kit delivered",
  "order.completed": "Order complete",
  "order.cancelled": "Cancelled",
  "order.payment_failed": "Payment failed",
  "order.failed": "Payment failed", // legacy spelling
  "results.awaiting_sample": "Waiting for your sample",
  "results.kit_activated": "Kit activated",
  "results.sample_processing_in_lab": "Sample at the lab",
  "results.partial_results_ready": "First results in",
  "results.results_ready": "Results ready",
  "results.sample_rejected": "Sample couldn't be processed",
  "results.lab_processing_error": "Lab processing problem",
  "results.escalation_raised": "Needs attention",
};

export function patientStatusLabel(status: string): string {
  return (
    PATIENT_STATUS_LABELS[status] ??
    status.replace(/^(order|results|fulfillment)\./, "").replaceAll("_", " ")
  );
}
