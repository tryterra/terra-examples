import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Toolbar } from "react-aria-components";
import { Button } from "@/client/components/shared/atoms/Button";
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function DateNavigator({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = value === today;
  const label = formatShortDate(value);

  return (
    <Toolbar
      aria-label="Date navigation"
      orientation="horizontal"
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
    >
      <Button
        variant="quiet"
        size="sm"
        aria-label="Previous day"
        onPress={() => onChange(addDays(value, -1))}
        className="rounded-lg"
      >
        <CaretLeftIcon size={16} weight="bold" className="text-subtle-text" />
      </Button>
      <span className="text-sm font-medium select-none text-center text-main-black">
        {label}
      </span>
      <Button
        variant="quiet"
        size="sm"
        aria-label="Next day"
        isDisabled={isToday}
        onPress={() => onChange(addDays(value, 1))}
        className="rounded-lg"
      >
        <CaretRightIcon
          size={16}
          weight="bold"
          className={`text-subtle-text ${isToday && "text-subtle-text/50"}`}
        />
      </Button>
    </Toolbar>
  );
}
