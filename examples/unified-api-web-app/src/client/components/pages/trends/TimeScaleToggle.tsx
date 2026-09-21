import type { Key } from "react-aria-components";
import { ToggleButton } from "@/client/components/shared/atoms/ToggleButton";
import { ToggleButtonGroup } from "@/client/components/shared/atoms/ToggleButtonGroup";

const SCALES = ["day", "week", "month"] as const;
export type TimeScale = (typeof SCALES)[number];

const LABELS: Record<TimeScale, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export function TimeScaleToggle({
  value,
  onChange,
  disableDay,
}: {
  value: TimeScale;
  onChange: (scale: TimeScale) => void;
  disableDay?: boolean;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Time scale"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([value])}
      onSelectionChange={(keys: Set<Key>) => {
        const key = [...keys][0] as TimeScale;
        if (key) onChange(key);
      }}
    >
      {SCALES.map((scale) => (
        <ToggleButton
          key={scale}
          id={scale}
          isDisabled={scale === "day" && disableDay}
        >
          {LABELS[scale]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
