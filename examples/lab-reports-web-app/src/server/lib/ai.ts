/**
 * AI analytics over the patient's combined data, via the Claude API.
 *
 * The deterministic engine (lib/analysis) stays the source of the gauge
 * scores; Claude narrates — a short overview for the patient page and a
 * full analytics report on demand. Both are generated from the same
 * assembled context (labs across all reports, biomarker trends, wearable
 * series, deterministic domain scores) and cached in SQLite keyed by an
 * input hash, so unchanged data never re-generates or drifts.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { desc, eq, and } from "drizzle-orm";
import { createDb, schema } from "./db";
import { analysePatient, type Analysis } from "./analysis";
import { getBiomarkerTrends, type BiomarkerTrend } from "./lab-trends";
import {
  getWearableSummary,
  windowFromDays,
  type WearableSummary,
} from "./wearables";

const db = createDb();
export const MODEL = "claude-opus-5";

export function aiEnabled(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

let cachedClient: Anthropic | undefined;
export function client(): Anthropic {
  cachedClient ??= new Anthropic();
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Context assembly — one compact, deterministic text block for both prompts.
// ---------------------------------------------------------------------------

interface PatientRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  referenceId: string;
}

function age(dateOfBirth: string): number {
  return Math.floor(
    (Date.now() - new Date(`${dateOfBirth}T00:00:00`).getTime()) / 31_557_600_000,
  );
}

function trendLines(trends: BiomarkerTrend[]): string {
  return trends
    .map((t) => {
      const points = t.points.map((p) => `${p.date}: ${p.value}`).join(", ");
      const range = t.latestRange
        ? ` (reference ${t.latestRange.lower ?? ""}-${t.latestRange.upper ?? ""})`
        : "";
      return `- ${t.displayName} [${t.unit}]${range}: ${points}`;
    })
    .join("\n");
}

function wearableLines(w: WearableSummary): string {
  if (!w.connected) return "No wearable connected.";
  const lines: string[] = [];
  for (const [metric, points] of Object.entries(w.series)) {
    if (points.length === 0) continue;
    const values = points.map((p) => p.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    lines.push(
      `- ${metric}: ${points.length} days, mean ${Math.round(mean * 10) / 10}, ` +
        `min ${Math.min(...values)}, max ${Math.max(...values)}, ` +
        `latest ${values[values.length - 1]} (${points[points.length - 1].date})`,
    );
  }
  return lines.length > 0 ? lines.join("\n") : "Wearable connected, no data in window.";
}

function analysisLines(a: Analysis): string {
  return a.domains
    .map(
      (d) =>
        `- ${d.label}: ${d.score ?? "n/a"} (${d.status}); inputs: ` +
        d.contributions
          .map((c) => `${c.label}=${c.valueText} (subscore ${c.subscore})`)
          .join(", "),
    )
    .join("\n");
}

export interface AiContext {
  text: string;
  hash: string;
}

export async function buildContext(patient: PatientRow): Promise<AiContext> {
  const [analysis, trends, wearables] = await Promise.all([
    analysePatient(patient.referenceId),
    getBiomarkerTrends(patient.referenceId),
    getWearableSummary(patient.referenceId, windowFromDays(30)),
  ]);

  const text = [
    `PATIENT: ${age(patient.dateOfBirth)}-year-old ${patient.sex}.`,
    `LAB REPORTS: ${analysis.inputs.labSessionIds.length} standardized reports; latest collection ${analysis.inputs.latestReportDate ?? "unknown"}.`,
    "",
    "BIOMARKER TRENDS ACROSS REPORTS (chronological values):",
    trendLines(trends) || "None (fewer than two reports).",
    "",
    "WEARABLE DATA (last 30 days):",
    wearableLines(wearables),
    "",
    "DETERMINISTIC DOMAIN SCORES (0-100, computed by the dashboard's rule engine):",
    analysisLines(analysis),
  ].join("\n");

  // Prompt version is part of the hash: changing the prompts below must
  // invalidate cached generations even when the data is unchanged.
  const PROMPT_VERSION = "v5";
  return {
    text,
    hash: createHash("sha256")
      .update(text)
      .update(PROMPT_VERSION)
      .digest("hex"),
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const OVERVIEW_SYSTEM = `You are a clinical decision-support assistant embedded in a doctor-facing dashboard that combines standardized lab reports with wearable data. You write for a physician, not a patient. Ground every statement in the specific values and dates provided; never invent values. You are decision support, not a diagnostic tool; never diagnose, never prescribe. Never use arrow characters or em dashes in your output: write value sequences as comma lists ("138, 143, 141") and use plain hyphens or semicolons for asides.`;

function textOf(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") {
    throw new Error("The model declined to generate this content.");
  }
  return message.content
    .filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    )
    .map((b) => b.text)
    .join("")
    .trim();
}

async function generateOverview(context: AiContext): Promise<string> {
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: OVERVIEW_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${context.text}\n\nSummarize this patient as 3-5 terse markdown bullets ("- ") in clinical chart-note style, most relevant first (prefer multi-year trends). Hard rules: ≤12 words per bullet; lead with the marker and numbers; abbreviate like a chart note (e.g. "LDL 141, flat 4y (138, 143, 141); TC up 197 to 220"); no arrows or em dashes anywhere; no full sentences, no hedging, no "the patient", no preamble, no closing line, no bold or any other markdown emphasis, plain text bullets only.`,
      },
    ],
  });
  return textOf(response as unknown as Anthropic.Message);
}

// ---------------------------------------------------------------------------
// Cached access
// ---------------------------------------------------------------------------

export interface AiContent {
  content: string;
  model: string;
  createdAt: Date;
  cached: boolean;
}

/**
 * Newest cached overview regardless of input hash — served when no API key
 * is configured (demo mode ships pre-generated briefs; data there is static
 * but "today"-relative hashes are not).
 */
export async function getLatestCachedOverview(
  patientId: string,
): Promise<AiContent | null> {
  const [hit] = await db
    .select()
    .from(schema.aiReport)
    .where(
      and(
        eq(schema.aiReport.patientId, patientId),
        eq(schema.aiReport.kind, "overview"),
      ),
    )
    .orderBy(desc(schema.aiReport.createdAt))
    .limit(1);
  if (!hit) return null;
  return {
    content: hit.content,
    model: hit.model,
    createdAt: hit.createdAt,
    cached: true,
  };
}

export async function getOrGenerateOverview(
  patient: PatientRow,
  force = false,
): Promise<AiContent> {
  const context = await buildContext(patient);
  if (!force) {
    const [hit] = await db
      .select()
      .from(schema.aiReport)
      .where(
        and(
          eq(schema.aiReport.patientId, patient.id),
          eq(schema.aiReport.kind, "overview"),
          eq(schema.aiReport.inputHash, context.hash),
        ),
      )
      .orderBy(desc(schema.aiReport.createdAt))
      .limit(1);
    if (hit) {
      return {
        content: hit.content,
        model: hit.model,
        createdAt: hit.createdAt,
        cached: true,
      };
    }
  }

  const content = await generateOverview(context);
  const [row] = await db
    .insert(schema.aiReport)
    .values({
      patientId: patient.id,
      kind: "overview",
      model: MODEL,
      inputHash: context.hash,
      content,
    })
    .returning();
  return { content, model: MODEL, createdAt: row.createdAt, cached: false };
}
