/**
 * AI wearable-signal insight for ONE flagged biomarker: Terra AI reviews the
 * patient's full wearable history against the biomarker's lab draws and
 * returns a short overview plus the wearable metrics (if any) whose patterns
 * plausibly relate to it — structured output, so the client can chart every
 * cited metric against the lab values. "Nothing significant" is a first-class
 * answer, not a failure.
 *
 * The numbers shown next to the text stay deterministic: the model picks
 * WHICH metrics matter and explains why; the series it gets charted against
 * are computed here, not generated.
 */
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { createDb, schema } from "./db";
import { aiEnabled, client, MODEL } from "./ai";
import { assessLabHistory } from "./analysis/lab-history";
import { getBiomarkerTrends } from "./lab-trends";
import {
  getWearableSummary,
  METRIC_KEYS,
  type MetricKey,
  type WearableWindow,
} from "./wearables";

const db = createDb();
const dayMs = 86_400_000;
const ts = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const MAX_LOOKBACK_DAYS = 500;
const DRAW_WINDOW_DAYS = 56;
const PROMPT_VERSION = "v2";

/** Display metadata + weekly-rollup mode per wearable metric. */
const METRIC_META: Record<
  string,
  { label: string; unit: string; agg: "sum" | "avg" }
> = {
  restingHr: { label: "Resting HR", unit: "bpm", agg: "avg" },
  hrv: { label: "HRV", unit: "ms", agg: "avg" },
  steps: { label: "Steps", unit: "steps/day", agg: "avg" },
  sleepDurationMin: { label: "Sleep", unit: "min/night", agg: "avg" },
  sleepEfficiency: { label: "Sleep efficiency", unit: "%", agg: "avg" },
  deepSleepMin: { label: "Deep sleep", unit: "min/night", agg: "avg" },
  remSleepMin: { label: "REM sleep", unit: "min/night", agg: "avg" },
  sleepScore: { label: "Sleep score", unit: "", agg: "avg" },
  glucoseAvg: { label: "Avg glucose", unit: "mg/dL", agg: "avg" },
  glucoseTimeInRange: { label: "Glucose in range", unit: "%", agg: "avg" },
  bpSystolic: { label: "Systolic BP", unit: "mmHg", agg: "avg" },
  bpDiastolic: { label: "Diastolic BP", unit: "mmHg", agg: "avg" },
  workoutMinutes: { label: "Training volume", unit: "min/week", agg: "sum" },
  workoutCalories: { label: "Training calories", unit: "kcal/week", agg: "sum" },
  workoutAvgHr: { label: "Workout avg HR", unit: "bpm", agg: "avg" },
  recoveryScore: { label: "Recovery score", unit: "%", agg: "avg" },
};

const SignalSchema = z.object({
  metric: z.enum(METRIC_KEYS),
  direction: z.enum(["may_push_higher", "may_push_lower", "unclear"]),
  strength: z.enum(["weak", "moderate", "notable"]),
  explanation: z
    .string()
    .describe(
      "One or two sentences citing the specific numbers from the data that make this metric worth looking at for this biomarker. Hedged language, no arrows, no em dashes.",
    ),
});

const InsightSchema = z.object({
  overview: z
    .string()
    .describe(
      "2-4 sentences for a physician summarizing what the wearable data does or does not suggest about this flagged value. Hedged, grounded in the provided numbers, no arrows or em dashes, no recommendations.",
    ),
  noSignificantFindings: z
    .boolean()
    .describe(
      "True when the wearable data shows no pattern worth a physician's attention for this biomarker.",
    ),
  signals: z
    .array(SignalSchema)
    .max(3)
    .describe(
      "The wearable metrics whose data shows a pattern plausibly related to this biomarker, strongest first. Empty when noSignificantFindings is true. Only cite a metric when its numbers actually show something; physiological plausibility alone is not enough.",
    ),
});

type ParsedInsight = z.infer<typeof InsightSchema>;

export interface FlagInsightSignal {
  metric: MetricKey;
  metricLabel: string;
  metricUnit: string;
  direction: "may_push_higher" | "may_push_lower" | "unclear";
  strength: "weak" | "moderate" | "notable";
  explanation: string;
  /** Weekly rollup for charting against the lab draws. */
  weekly: Array<{ date: string; value: number }>;
}

export interface FlagInsight {
  biomarkerKey: string;
  biomarkerLabel: string;
  unit: string;
  lab: Array<{ date: string; value: number }>;
  overview: string;
  noSignificantFindings: boolean;
  signals: FlagInsightSignal[];
  model: string;
  createdAt: Date;
  cached: boolean;
}

function weeklyRollup(
  series: Array<{ date: string; value: number }>,
  agg: "sum" | "avg",
): Array<{ date: string; value: number }> {
  const byWeek = new Map<string, { total: number; days: number }>();
  for (const p of series) {
    const t = ts(p.date);
    const day = new Date(t).getUTCDay();
    const monday = t - ((day + 6) % 7) * dayMs;
    const key = isoDate(monday);
    const b = byWeek.get(key) ?? { total: 0, days: 0 };
    b.total += p.value;
    b.days += 1;
    byWeek.set(key, b);
  }
  return [...byWeek.entries()]
    .map(([date, b]) => ({
      date,
      value: Math.round((agg === "sum" ? b.total : b.total / b.days) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** Compact per-metric summary: overall stats, halves, per-draw windows. */
function metricLines(
  series: Record<string, Array<{ date: string; value: number }>>,
  drawDates: string[],
): string {
  const lines: string[] = [];
  for (const key of METRIC_KEYS) {
    const s = series[key] ?? [];
    if (s.length < 7) continue;
    const meta = METRIC_META[key] ?? { label: key, unit: "", agg: "avg" };
    const values = s.map((p) => p.value);
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    const half = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, half);
    const secondHalf = values.slice(half);
    const avg = (v: number[]) => v.reduce((a, x) => a + x, 0) / v.length;
    const windows = drawDates
      .map((d) => {
        const end = ts(d);
        const start = end - (DRAW_WINDOW_DAYS - 1) * dayMs;
        const inWindow = s.filter((p) => {
          const t = ts(p.date);
          return t >= start && t <= end;
        });
        if (inWindow.length === 0) return `${d}: no data`;
        return `${d}: mean ${fmt(avg(inWindow.map((p) => p.value)))} over ${inWindow.length} days`;
      })
      .join("; ");
    lines.push(
      `- ${key} (${meta.label}, daily values): ${s.length} days from ${s[0].date} to ${s[s.length - 1].date}; ` +
        `overall mean ${fmt(mean)}, earlier-half mean ${fmt(avg(firstHalf))}, recent-half mean ${fmt(avg(secondHalf))}. ` +
        `8-week window before each draw: ${windows}`,
    );
  }
  return lines.join("\n");
}

const SYSTEM = `You are a clinical decision-support assistant in a doctor-facing dashboard that joins standardized lab reports with wearable data. You write for a physician. Ground every claim in the specific values provided; never invent numbers. You surface hedged associations ("commonly associated with", "may relate to"), never diagnoses or recommendations. Only cite a wearable metric when this patient's data actually shows a pattern worth attention; if nothing does, say so plainly. Never use arrow characters or em dashes; write value sequences as comma lists and asides with plain hyphens.`;

async function generate(
  biomarkerLabel: string,
  unit: string,
  labLine: string,
  historyLine: string,
  wearableBlock: string,
): Promise<ParsedInsight> {
  const message = await client().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `FLAGGED BIOMARKER: ${biomarkerLabel} [${unit}]`,
          `Lab draws (chronological): ${labLine}`,
          historyLine,
          "",
          "WEARABLE DATA (same patient; daily series summarized):",
          wearableBlock || "No wearable data available.",
          "",
          `Task: assess which wearable metrics, if any, show patterns in THIS patient's data that plausibly relate to the flagged ${biomarkerLabel}. Consider both established physiology and what the numbers actually did (level, trend between halves, and the 8-week windows before each draw). Treat draws that predate the wearable data as the pre-wearable baseline period: comparing labs before versus after the wearable era shows what the patient's measured lifestyle actually changed. If the data shows nothing meaningful for this biomarker, return noSignificantFindings true with an overview that says so.`,
        ].join("\n"),
      },
    ],
    output_config: { format: zodOutputFormat(InsightSchema) },
  });
  if (message.stop_reason === "refusal" || !message.parsed_output) {
    throw new Error("The model declined to analyze this biomarker.");
  }
  return message.parsed_output;
}

export async function getOrGenerateFlagInsight(
  patientId: string,
  referenceId: string,
  biomarkerKey: string,
  force = false,
): Promise<FlagInsight | null> {
  const trends = await getBiomarkerTrends(referenceId);
  const trend = trends.find((t) => t.key === biomarkerKey);
  if (!trend) return null;

  const now = Date.now();
  const window: WearableWindow = {
    start: isoDate(now - (MAX_LOOKBACK_DAYS - 1) * dayMs),
    end: isoDate(now),
  };
  const summary = await getWearableSummary(referenceId, window);

  const labLine = trend.points
    .map((p) => `${p.date}: ${p.value}`)
    .join(", ");
  const drawDates = trend.points
    .map((p) => p.date)
    .filter((d) => ts(d) >= ts(window.start));
  const wearableBlock = summary.connected
    ? metricLines(summary.series, drawDates)
    : "";

  // Deterministic longitudinal read (baseline, chronicity, trajectory) so
  // the model frames the earlier, pre-wearable draws correctly.
  const assessment = (await assessLabHistory(referenceId))[biomarkerKey];
  const firstWearableDay = Object.values(summary.series)
    .flat()
    .reduce<string | null>(
      (min, p) => (min === null || p.date < min ? p.date : min),
      null,
    );
  const historyLine = assessment
    ? `Deterministic history assessment: baseline ${assessment.baseline.value} ${assessment.unit} on ${assessment.baseline.date}; classified ${assessment.chronicity}` +
      (assessment.abnormalSince
        ? ` (abnormal in ${assessment.consecutiveAbnormal} consecutive draws since ${assessment.abnormalSince})`
        : "") +
      `; trajectory ${assessment.trajectory} across ${assessment.spanYears}y.` +
      (firstWearableDay
        ? ` Wearable data begins ${firstWearableDay}; earlier draws are pre-wearable.`
        : "")
    : "";

  const hash = createHash("sha256")
    .update(biomarkerKey)
    .update(labLine)
    .update(historyLine)
    .update(wearableBlock)
    .update(PROMPT_VERSION)
    .digest("hex");

  const attachSeries = (parsed: ParsedInsight): FlagInsightSignal[] =>
    parsed.signals
      .filter((s) => (summary.series[s.metric] ?? []).length >= 7)
      .map((s) => {
        const meta = METRIC_META[s.metric] ?? {
          label: s.metric,
          unit: "",
          agg: "avg" as const,
        };
        return {
          ...s,
          metricLabel: meta.label,
          metricUnit: meta.unit,
          weekly: weeklyRollup(summary.series[s.metric], meta.agg),
        };
      });

  const fromRow = (row: {
    content: string;
    model: string;
    createdAt: Date;
  }): FlagInsight => {
    const parsed = InsightSchema.parse(JSON.parse(row.content));
    return {
      biomarkerKey,
      biomarkerLabel: trend.displayName,
      unit: trend.unit,
      lab: trend.points.map((p) => ({ date: p.date, value: p.value })),
      overview: parsed.overview,
      noSignificantFindings: parsed.noSignificantFindings,
      signals: attachSeries(parsed),
      model: row.model,
      createdAt: row.createdAt,
      cached: true,
    };
  };

  // No key: serve the newest pre-generated insight for this biomarker
  // (demo mode) — the "today"-relative hash can't match, so match on the
  // biomarkerKey stored inside the content instead.
  if (!aiEnabled()) {
    const rows = await db
      .select()
      .from(schema.aiReport)
      .where(
        and(
          eq(schema.aiReport.patientId, patientId),
          eq(schema.aiReport.kind, "flag"),
        ),
      )
      .orderBy(desc(schema.aiReport.createdAt));
    for (const row of rows) {
      const raw = JSON.parse(row.content) as { biomarkerKey?: string };
      if (raw.biomarkerKey === biomarkerKey) return fromRow(row);
    }
    return null;
  }

  if (!force) {
    const [hit] = await db
      .select()
      .from(schema.aiReport)
      .where(
        and(
          eq(schema.aiReport.patientId, patientId),
          eq(schema.aiReport.kind, "flag"),
          eq(schema.aiReport.inputHash, hash),
        ),
      )
      .orderBy(desc(schema.aiReport.createdAt))
      .limit(1);
    if (hit) return fromRow(hit);
  }

  const parsed = await generate(
    trend.displayName,
    trend.unit,
    labLine,
    historyLine,
    wearableBlock,
  );
  const [row] = await db
    .insert(schema.aiReport)
    .values({
      patientId,
      kind: "flag",
      model: MODEL,
      inputHash: hash,
      content: JSON.stringify({ biomarkerKey, ...parsed }),
    })
    .returning();

  return {
    biomarkerKey,
    biomarkerLabel: trend.displayName,
    unit: trend.unit,
    lab: trend.points.map((p) => ({ date: p.date, value: p.value })),
    overview: parsed.overview,
    noSignificantFindings: parsed.noSignificantFindings,
    signals: attachSeries(parsed),
    model: MODEL,
    createdAt: row.createdAt,
    cached: false,
  };
}
