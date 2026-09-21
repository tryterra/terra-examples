import {
  BarbellIcon,
  ClockIcon,
  MoonIcon,
  PersonSimpleRunIcon,
  PersonSimpleWalkIcon,
  TimerIcon,
  DevicesIcon,
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { formatDuration, formatTime } from "@/client/lib/format";

/* --- */

function getActivityLabel(
  type: string,
  activityType: string | null,
  distance: number | null,
): string {
  if (type === "sleep") return "Sleep";
  if (activityType && activityType !== "Other") return activityType;
  if (distance != null && distance > 3000) return "Run";
  return "Activity";
}

function getActivityIcon(label: string, type: string): ReactNode {
  const iconProps = {
    size: 24,
    weight: "bold" as const,
    className: "text-emphasis",
  };
  if (type === "sleep") return <MoonIcon {...iconProps} />;
  const l = label.toLowerCase();
  if (l.includes("walk")) return <PersonSimpleWalkIcon {...iconProps} />;
  if (l.includes("gym") || l.includes("weight"))
    return <BarbellIcon {...iconProps} />;
  return <PersonSimpleRunIcon {...iconProps} />;
}

/* --- */

export function ActivityItem({
  activity,
  showBorder,
  providerName,
}: {
  activity: {
    type: string;
    activityType: string | null;
    startTime: string;
    endTime: string;
    distance: number | null;
  };
  showBorder: boolean;
  providerName?: string;
}) {
  const label = getActivityLabel(
    activity.type,
    activity.activityType,
    activity.distance,
  );
  const desc =
    activity.distance != null &&
    activity.distance > 0 &&
    activity.type !== "sleep"
      ? `${label} – ${(activity.distance / 1000).toFixed(2)} km`
      : label;

  return (
    <div
      className={`flex items-center py-4 ${showBorder ? "border-b border-border" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-emphasis-bg">
          {getActivityIcon(label, activity.type)}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-base font-medium text-main-black">{desc}</span>
          <div className="flex items-center gap-3 text-sm text-secondary-text">
            <span className="flex items-center gap-1">
              {activity.type === "sleep" ? (
                <MoonIcon size={16} className="text-secondary-text" />
              ) : (
                <ClockIcon size={16} className="text-secondary-text" />
              )}
              {formatTime(activity.startTime)}
            </span>
            <span className="flex items-center gap-1">
              <TimerIcon size={16} className="text-secondary-text" />
              {formatDuration(activity.startTime, activity.endTime)}
            </span>
            {providerName && (
              <span className="flex items-center gap-1">
                <DevicesIcon size={16} className="text-secondary-text" />
                {providerName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
