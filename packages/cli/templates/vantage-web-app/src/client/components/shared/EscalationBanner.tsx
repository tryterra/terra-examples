/**
 * Escalation banner. warning tier for low/medium; failure tier (the one
 * approved use of the failure palette) for high/very_high. Patient surfaces
 * get plain-language severity; the raw enum stays in ops.
 */
import { WarningIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { formatDateTime } from "../../lib/format";

const SEVERITY_COPY: Record<string, string> = {
  very_low: "A few values are slightly outside their expected range.",
  low: "Some values are outside their expected range.",
  medium: "Some values need attention.",
  high: "Some values need prompt attention.",
  very_high: "Some values need urgent attention.",
};

export function EscalationBanner({
  level,
  dueBy,
  showRawLevel = false,
}: {
  level: string;
  dueBy?: string;
  showRawLevel?: boolean;
}) {
  if (!level || level === "not_escalated") return null;
  const critical = level === "high" || level === "very_high";
  const Icon = critical ? WarningOctagonIcon : WarningIcon;
  return (
    <div
      className={`flex w-full items-center gap-4 rounded-xl border p-4 ${
        critical
          ? "border-failure bg-failure-bg"
          : "border-warning bg-warning-bg"
      }`}
    >
      <Icon
        size={24}
        weight="bold"
        className={critical ? "text-failure" : "text-warning"}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p
          className={`font-semibold ${critical ? "text-failure" : "text-warning"}`}
        >
          {SEVERITY_COPY[level] ?? "These results need review."}
          {showRawLevel ? ` (escalation_level: ${level})` : ""}
        </p>
        {dueBy && (
          <p className="text-sm text-secondary-text">
            Please review and acknowledge by {formatDateTime(dueBy)}.
          </p>
        )}
      </div>
    </div>
  );
}
