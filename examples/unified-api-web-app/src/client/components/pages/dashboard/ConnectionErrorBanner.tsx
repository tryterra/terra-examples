import { ArrowRightIcon, WarningIcon } from "@phosphor-icons/react";
import { Link } from "@/client/components/shared/atoms/Link";

export function ConnectionErrorBanner({
  providerNames,
}: {
  providerNames: string[];
}) {
  if (providerNames.length === 0) return null;

  const message =
    providerNames.length === 1
      ? `Your ${providerNames[0]} connection has an issue`
      : `${providerNames.join(" and ")} connections have issues`;

  return (
    <div className="w-full flex items-center gap-4 rounded-xl border border-warning bg-warning-bg p-4">
      <div className="w-full flex gap-2 items-center">
        <WarningIcon
          size={24}
          className="shrink-0 text-warning"
          weight="bold"
        />
        <p className="w-full font-semibold text-warning">{message}</p>
      </div>
      <Link variant="button-quiet" to="/connectors" className="h-10">
        <ArrowRightIcon size={24} className="text-warning" />
      </Link>
    </div>
  );
}
