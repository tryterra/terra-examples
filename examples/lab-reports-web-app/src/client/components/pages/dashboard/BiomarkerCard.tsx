import { ChartLineIcon } from "@phosphor-icons/react/ChartLine";
import { ShieldWarningIcon } from "@phosphor-icons/react/ShieldWarning";
import { type ReactNode } from "react";
import { TooltipTrigger } from "react-aria-components";
import { Button } from "@/client/components/shared/atoms/Button";
import { Tooltip } from "@/client/components/shared/atoms/Tooltip";
import { Badge } from "@/client/components/shared/atoms/Badge";

type HealthStatus = "Good" | "Poor";

export function BiomarkerCard({
  icon,
  title,
  value = null,
  unit,
  s = null,
  source,
  onTrends,
}: {
  icon: ReactNode;
  title: string;
  value?: string | null;
  unit?: string;
  s?: HealthStatus | null;
  source?: string;
  onTrends?: () => void;
}) {
  const hasData = value != null;

  return (
    <div className="group flex flex-col items-start gap-4 rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-card">
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full border border-main-black bg-main-purple">
              {icon}
            </span>
            <span className="text-base font-medium text-main-black">
              {title}
            </span>
          </div>

          {hasData ? (
            <p className="text-main-black">
              <span className="text-[28px] font-semibold leading-none">
                {value}
              </span>{" "}
              <span className="text-sm text-subtle-text">{unit}</span>
            </p>
          ) : (
            <p className="flex flex-1 items-center">
              <span className="text-[28px] font-medium leading-none text-subtle-text">
                –
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onTrends && (
            <TooltipTrigger delay={0} closeDelay={0}>
              <Button
                variant="quiet"
                size="sm"
                className="group/btn aspect-square px-0 hover:bg-emphasis-bg pressed:bg-emphasis-bg-pressed"
                onPress={onTrends}
              >
                <ChartLineIcon
                  size={24}
                  className="text-subtle-text transition-colors group-hover/btn:text-emphasis"
                />
              </Button>
              <Tooltip>View trends</Tooltip>
            </TooltipTrigger>
          )}
        </div>
      </div>

      {(hasData || source) && (
        <div className="w-full flex items-center gap-2 justify-between">
          {hasData ? (
            <Badge variant={s === "Good" ? "emphasis" : "warning"}>
              {s !== "Good" && <ShieldWarningIcon size={16} weight="bold" />}
              {s}
            </Badge>
          ) : (
            <span />
          )}
          {source && <span className="text-xs text-subtle-text">{source}</span>}
        </div>
      )}
    </div>
  );
}
