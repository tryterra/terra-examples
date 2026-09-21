/**
 * Pre-draw context per lab report: what the patient's wearable shows in the
 * window right before each blood draw. Recent exertion inflates CK, AST/ALT,
 * creatinine and CRP; short sleep skews fasting glucose and cortisol — a
 * doctor reading the report needs that context next to the numbers.
 * Day-granularity (wearable series are daily aggregates).
 */
import { listSessions } from "./lab-reports";
import { getWearableSummary, type WearableWindow } from "./wearables";

const dayMs = 86_400_000;
const ts = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const MAX_LOOKBACK_DAYS = 500;

export interface DrawContext {
  sessionId: string;
  date: string;
  /** Days between the most recent workout and the draw (0 = draw day,
   *  1 = day before). Null when no workout in the 7 days before. */
  daysSinceWorkout: number | null;
  lastWorkoutMinutes: number | null;
  /** Mean sleep over the 7 nights before the draw (minutes). */
  sleepAvg7dMin: number | null;
}

export async function getDrawContexts(
  referenceId: string,
): Promise<DrawContext[]> {
  const sessions = await listSessions(referenceId);
  const dated = sessions
    .map((s) => ({
      sessionId: s.session_id,
      date: s.collection_date ?? s.report_date,
    }))
    .filter((s): s is { sessionId: string; date: string } => Boolean(s.date));
  if (dated.length === 0) return [];

  const now = Date.now();
  const window: WearableWindow = {
    start: isoDate(now - (MAX_LOOKBACK_DAYS - 1) * dayMs),
    end: isoDate(now),
  };
  const summary = await getWearableSummary(referenceId, window);
  if (!summary.connected) return [];

  const workouts = summary.series.workoutMinutes;
  const sleep = summary.series.sleepDurationMin;
  const firstData = Math.min(
    ...[...workouts, ...sleep].map((p) => ts(p.date)),
  );

  const out: DrawContext[] = [];
  for (const s of dated) {
    const draw = ts(s.date);
    // Only draws inside the wearable history get context — absence of data
    // must never read as "no workout".
    if (!Number.isFinite(firstData) || draw < firstData || draw > now) {
      continue;
    }

    let daysSinceWorkout: number | null = null;
    let lastWorkoutMinutes: number | null = null;
    for (const p of workouts) {
      const t = ts(p.date);
      if (t > draw || t < draw - 7 * dayMs) continue;
      const days = Math.round((draw - t) / dayMs);
      if (daysSinceWorkout === null || days < daysSinceWorkout) {
        daysSinceWorkout = days;
        lastWorkoutMinutes = p.value;
      }
    }

    const nights = sleep.filter((p) => {
      const t = ts(p.date);
      return t < draw && t >= draw - 7 * dayMs;
    });
    const sleepAvg7dMin =
      nights.length >= 3
        ? nights.reduce((sum, p) => sum + p.value, 0) / nights.length
        : null;

    out.push({
      sessionId: s.sessionId,
      date: s.date,
      daysSinceWorkout,
      lastWorkoutMinutes,
      sleepAvg7dMin,
    });
  }
  return out;
}
