/**
 * Pre-draw wearable context chips for a lab report: recent exertion and the
 * week's sleep before the draw — the interpretation context a doctor needs
 * next to the numbers (post-exercise CK/ALT/CRP inflation, sleep-skewed
 * fasting glucose/cortisol). Renders nothing when the draw predates the
 * wearable history.
 */
import { useQuery } from "@tanstack/react-query";
import { BarbellIcon, MoonStarsIcon } from "@phosphor-icons/react";
import { drawContextQuery } from "../../lib/queries";

function Chip({
  warn,
  icon,
  children,
}: {
  warn: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        warn
          ? "border-warning bg-warning-bg text-warning"
          : "border-border bg-white text-secondary-text"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}

export function DrawContextChips({
  patientId,
  sessionId,
}: {
  patientId: string;
  sessionId: string;
}) {
  const ctxQ = useQuery(drawContextQuery(patientId));
  const ctx = ctxQ.data?.contexts.find((c) => c.sessionId === sessionId);
  if (!ctx) return null;

  const sleepH =
    ctx.sleepAvg7dMin != null ? ctx.sleepAvg7dMin / 60 : null;
  const shortSleep = sleepH != null && sleepH < 6.5;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium tracking-wide text-subtle-text uppercase">
        Pre-draw context (wearable)
      </span>
      <div className="flex flex-wrap gap-2">
        {ctx.daysSinceWorkout != null && ctx.daysSinceWorkout <= 1 ? (
          <Chip warn icon={<BarbellIcon size={14} weight="bold" />}>
            Workout{" "}
            {ctx.daysSinceWorkout === 0 ? "on draw day" : "the day before"}
            {ctx.lastWorkoutMinutes != null &&
              ` (${Math.round(ctx.lastWorkoutMinutes)} min)`}{" "}
            · CK, liver enzymes and CRP can run high after exertion
          </Chip>
        ) : (
          <Chip warn={false} icon={<BarbellIcon size={14} />}>
            No workout in the 2 days before this draw
          </Chip>
        )}
        {sleepH != null && (
          <Chip
            warn={shortSleep}
            icon={<MoonStarsIcon size={14} weight={shortSleep ? "bold" : "regular"} />}
          >
            Slept {sleepH.toFixed(1)} h/night the week before
            {shortSleep && " · short sleep can skew glucose and cortisol"}
          </Chip>
        )}
      </div>
    </div>
  );
}
