/** Computes sleep duration in minutes from start/end ISO timestamps. */
export function sleepDurationMinutes(
  startTime: string,
  endTime: string,
): number {
  return Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000,
  );
}
