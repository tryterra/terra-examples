import { ChartLineIcon, SparkleIcon } from "@phosphor-icons/react";
import { Button, TooltipTrigger } from "react-aria-components";
import { Tooltip } from "@/client/components/shared/atoms/Tooltip";
import { ShieldWarningIcon } from "@phosphor-icons/react";
import { Badge } from "@/client/components/shared/atoms/Badge";

type HealthStatus = "Good" | "Poor";

function ScoreGauge({
  score,
  s = null,
  size = 100,
}: {
  score: number | null;
  s?: HealthStatus | null;
  size?: number;
}) {
  const cx = 58.3;
  const cy = 58.3;
  const r = 54.3;
  const stroke = 6;
  const hasData = score != null;
  const pct = score == null ? 0 : Math.min(Math.max(score / 100, 0), 1);
  const color = s === "Poor" ? "var(--color-warning)" : "var(--color-emphasis)";

  // ~267° ring with a ~93° gap centred at the bottom; the knob marks the score.
  const gap = 93;
  const startAngle = 180 + gap / 2;
  const sweep = 360 - gap;

  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  const [x1, y1] = point(startAngle);
  const [x2, y2] = point(startAngle + sweep);
  const arc = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  const [knobX, knobY] = point(startAngle + pct * sweep);

  return (
    <svg
      viewBox="0 0 116.6 98.55"
      width={size}
      height={size * 0.845}
      className="overflow-visible"
    >
      {/* Black outline beneath the full arc */}
      <path
        d={arc}
        fill="none"
        stroke="var(--color-main-black)"
        strokeWidth={stroke + 2}
        strokeLinecap="round"
      />
      {/* Ring — status colour when populated, grey when empty */}
      <path
        d={arc}
        fill="none"
        stroke={hasData ? color : "var(--color-border)"}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <circle
        cx={knobX}
        cy={knobY}
        r={9.3}
        fill="var(--color-white)"
        stroke="var(--color-main-black)"
        strokeWidth={2}
      />
    </svg>
  );
}

export function ScoreCard({
  title,
  score = null,
  s = null,
  description,
  onExplore,
  onViewTrends,
}: {
  title: string;
  score?: number | null;
  s?: HealthStatus | null;
  description: string;
  onExplore?: () => void;
  onViewTrends?: () => void;
}) {
  const hasData = score != null;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-[10px] border border-border">
      <div
        className={`flex items-end justify-between p-4 ${
          s === "Poor" ? "bg-warning-bg" : "bg-emphasis-bg"
        }`}
      >
        <span className="text-lg font-semibold text-main-black">{title}</span>
        <div className="relative flex items-center justify-center">
          <ScoreGauge score={score} s={s} size={116} />
          <div className="absolute inset-0 flex translate-y-4 flex-col items-center justify-center">
            <span className="text-5xl font-semibold leading-tight text-main-black">
              {hasData ? score : "–"}
            </span>
            <span className="text-base text-secondary-text">
              {hasData ? s : "–"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 border-t border-border bg-white p-4">
        <div className="flex items-center justify-between">
          {hasData ? (
            <Badge variant={s === "Good" ? "emphasis" : "warning"}>
              {s !== "Good" && <ShieldWarningIcon size={16} weight="bold" />}
              {s}
            </Badge>
          ) : (
            <Badge variant="neutral">Insufficient data</Badge>
          )}
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <TooltipTrigger delay={0} closeDelay={0}>
              <Button
                className="group/btn flex size-8 items-center justify-center rounded-lg cursor-pointer transition hover:bg-emphasis-bg pressed:bg-emphasis-bg-pressed"
                onPress={onExplore}
              >
                <SparkleIcon
                  size={24}
                  className="text-subtle-text transition-colors group-hover/btn:text-emphasis"
                />
              </Button>
              <Tooltip>Explore with AI</Tooltip>
            </TooltipTrigger>
            <TooltipTrigger delay={0} closeDelay={0}>
              <Button
                className="group/btn flex size-8 items-center justify-center rounded-lg cursor-pointer transition hover:bg-emphasis-bg pressed:bg-emphasis-bg-pressed"
                onPress={onViewTrends}
              >
                <ChartLineIcon
                  size={24}
                  className="text-subtle-text transition-colors group-hover/btn:text-emphasis"
                />
              </Button>
              <Tooltip>View trends</Tooltip>
            </TooltipTrigger>
          </div>
        </div>
        <p className="text-base text-secondary-text line-clamp-3">
          {description}
        </p>
      </div>
    </div>
  );
}
