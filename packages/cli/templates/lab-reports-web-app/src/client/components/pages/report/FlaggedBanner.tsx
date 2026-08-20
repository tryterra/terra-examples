/** Out-of-range summary banner for a lab report. */
import { WarningIcon } from "@phosphor-icons/react";

export function FlaggedBanner({ flaggedCount }: { flaggedCount: number }) {
  if (flaggedCount === 0) return null;
  return (
    <div className="flex w-full items-center gap-4 rounded-xl border border-warning bg-warning-bg p-4">
      <WarningIcon size={24} weight="bold" className="text-warning" />
      <p className="font-semibold text-warning">
        {flaggedCount} {flaggedCount === 1 ? "result is" : "results are"}{" "}
        flagged outside the reference range.
      </p>
    </div>
  );
}
