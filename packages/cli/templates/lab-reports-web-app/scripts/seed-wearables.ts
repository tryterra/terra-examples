/**
 * Seed synthetic wearable data for a patient with no live Terra connection.
 * Writes ~18 months of daily/sleep/body/activity records into
 * wearableDayCache under a `demo:<referenceId>` user; the app then treats it
 * as a demo connection (cache-only, never fetched from Terra).
 *
 * Usage: npx tsx scripts/seed-wearables.ts <referenceId>
 * Deterministic (sinusoid + hash jitter) so re-runs produce identical data.
 *
 * The persona is a middle-aged recreational athlete whose training volume
 * RISES over the final six months while sleep stays chronically short — it
 * pairs with the sample lab story (persistently high LDL despite good
 * activity; the AI insight then argues activity is not the driver).
 */
import "dotenv/config";
import { createDb, schema } from "../src/server/lib/db";

const referenceId = process.argv[2];
if (!referenceId) {
  console.error("Usage: npx tsx scripts/seed-wearables.ts <referenceId>");
  process.exit(1);
}

const db = createDb();
const userId = `demo:${referenceId}`;
const DAYS = 540;

/** Deterministic jitter in [-1, 1] from a day index + salt. */
function jitter(day: number, salt: number): number {
  const x = Math.sin(day * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function isoDate(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const SPORTS = [
  { name: "Tennis", type: 84 },
  { name: "Running", type: 8 },
  { name: "Weightlifting", type: 45 },
  { name: "Cycling", type: 1 },
  { name: "Swimming", type: 82 },
];

const rowsToInsert: Array<{
  resource: "daily" | "sleep" | "body" | "activity";
  date: string;
  payload: string;
}> = [];

for (let i = DAYS - 1; i >= 0; i--) {
  const date = isoDate(i);
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
  // Training volume ramps up over the final six months.
  const trainingRamp = i < 180 ? 1 + (180 - i) / 360 : 1;
  // Winter dip in HRV/recovery around one-third through the window.
  const winterDip = Math.exp(-(((i - 200) / 45) ** 2)) * 5;

  const steps = Math.round(
    (weekend ? 11000 : 7800) + jitter(i, 1) * 2600 + Math.sin(i / 4) * 1200,
  );
  const restingHr = Math.round(
    57 + jitter(i, 2) * 3 + Math.sin(i / 9) * 1.5 + winterDip * 0.35,
  );
  const hrv = Math.round(
    44 + jitter(i, 3) * 8 + Math.sin(i / 7) * 4 - winterDip,
  );
  // Chronically shortish sleep, worse in the ~8 weeks before "today - 36d"
  // (the latest sample draw sits about five weeks back).
  const preDrawCrunch = i < 95 && i > 36 ? 26 : 0;
  const asleepMin = Math.round(
    385 + jitter(i, 4) * 52 + (weekend ? 30 : 0) - preDrawCrunch,
  );
  const deepMin = Math.round(asleepMin * (0.18 + jitter(i, 5) * 0.03));
  const remMin = Math.round(asleepMin * (0.22 + jitter(i, 6) * 0.04));
  const lightMin = asleepMin - deepMin - remMin;
  const efficiency = Math.round(88 + jitter(i, 7) * 5);
  const sleepScore = Math.round(
    Math.min(96, Math.max(48, asleepMin / 5.4 + jitter(i, 8) * 6)),
  );
  const recovery = Math.round(
    Math.min(
      98,
      Math.max(
        22,
        62 + jitter(i, 15) * 18 - winterDip * 2 - (preDrawCrunch ? 6 : 0),
      ),
    ),
  );
  const systolic = Math.round(122 + jitter(i, 9) * 5);
  const diastolic = Math.round(79 + jitter(i, 10) * 4);

  // Workouts ~5 days a week, longer on weekends, ramping in the last months.
  const trains = jitter(i, 11) > -0.55;
  const workouts: Array<Record<string, unknown>> = [];
  let dayStrain = 6 + jitter(i, 16) * 2;
  if (trains) {
    const sport = SPORTS[Math.abs(Math.round(jitter(i, 12) * 10)) % SPORTS.length];
    const minutes = Math.round(
      ((weekend ? 80 : 55) + jitter(i, 13) * 25) * trainingRamp,
    );
    const startHour = weekend ? 10 : 18;
    const start = `${date}T${String(startHour).padStart(2, "0")}:10:00.000000+01:00`;
    const end = `${date}T${String(startHour + Math.ceil(minutes / 60)).padStart(2, "0")}:${String((10 + minutes) % 60).padStart(2, "0")}:00.000000+01:00`;
    const avgHr = Math.round(126 + jitter(i, 14) * 14);
    workouts.push({
      metadata: { start_time: start, end_time: end, name: sport.name, type: sport.type },
      active_durations_data: { activity_seconds: minutes * 60 },
      calories_data: { total_burned_calories: Math.round(minutes * 8.6) },
      heart_rate_data: { summary: { avg_hr_bpm: avgHr, max_hr_bpm: avgHr + 28 } },
      strain_data: { strain_level: Math.round((8 + minutes / 18) * 10) / 10 },
    });
    dayStrain += minutes / 12;
  }

  rowsToInsert.push(
    {
      resource: "daily",
      date,
      payload: JSON.stringify([
        {
          metadata: { start_time: `${date}T00:00:00.000000+01:00` },
          heart_rate_data: {
            summary: { resting_hr_bpm: restingHr, avg_hrv_rmssd: hrv },
          },
          distance_data: { steps },
          strain_data: { strain_level: Math.round(dayStrain * 10) / 10 },
          scores: { recovery },
        },
      ]),
    },
    {
      resource: "sleep",
      date,
      payload: JSON.stringify([
        {
          metadata: {
            start_time: `${isoDate(i + 1)}T23:${String(30 + Math.abs(Math.round(jitter(i, 17) * 25))).padStart(2, "0")}:00.000000+01:00`,
            end_time: `${date}T07:0${Math.abs(Math.round(jitter(i, 18) * 5))}:00.000000+01:00`,
            is_nap: false,
          },
          heart_rate_data: {
            summary: { resting_hr_bpm: restingHr - 2, avg_hrv_rmssd: hrv },
          },
          sleep_durations_data: {
            asleep: {
              duration_asleep_state_seconds: asleepMin * 60,
              duration_deep_sleep_state_seconds: deepMin * 60,
              duration_REM_sleep_state_seconds: remMin * 60,
              duration_light_sleep_state_seconds: lightMin * 60,
            },
            sleep_efficiency: efficiency,
          },
          data_enrichment: { sleep_score: sleepScore },
        },
      ]),
    },
    {
      resource: "body",
      date,
      payload: JSON.stringify([
        {
          metadata: { start_time: `${date}T08:00:00.000000+01:00` },
          blood_pressure_data: {
            day_avg_systolic_bp: systolic,
            day_avg_diastolic_bp: diastolic,
          },
        },
      ]),
    },
    { resource: "activity", date, payload: JSON.stringify(workouts) },
  );
}

for (const row of rowsToInsert) {
  await db
    .insert(schema.wearableDayCache)
    .values({ userId, ...row })
    .onConflictDoUpdate({
      target: [
        schema.wearableDayCache.userId,
        schema.wearableDayCache.resource,
        schema.wearableDayCache.date,
      ],
      set: { payload: row.payload, fetchedAt: new Date() },
    });
}

console.log(
  `Seeded ${DAYS} days of demo wearable data for ${referenceId} (user ${userId}).`,
);
