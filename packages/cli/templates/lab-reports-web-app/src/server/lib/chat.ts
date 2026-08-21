/**
 * Health agent: a chat endpoint over the whole roster. The system prompt
 * carries every patient's assembled context (labs, trends, wearables,
 * deterministic scores) plus a marker for the patient currently on screen,
 * so "for this patient…" resolves naturally.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createDb, schema } from "./db";
import { aiEnabled, buildContext } from "./ai";

const db = createDb();
const MODEL = "claude-opus-5";

let cachedClient: Anthropic | undefined;
function client(): Anthropic {
  cachedClient ??= new Anthropic();
  return cachedClient;
}

export { aiEnabled };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_SYSTEM = `You are the health agent inside Terra's doctor-facing dashboard, talking to a clinician. You have each patient's standardized lab reports (with multi-year trends), wearable data, and the dashboard's deterministic domain scores in your context.

Rules:
- Ground every claim in the values and dates provided. If the data doesn't cover a question, say so plainly; never invent values.
- Never use arrow characters or em dashes: write value sequences as comma lists and use plain hyphens for asides.
- When the clinician says "this patient" they mean the patient marked CURRENTLY VIEWING. If no patient is marked and the question needs one, ask which patient they mean.
- Be concise: answer first, in a few short sentences or a compact list. Include concrete values with units.
- You are decision support, not a diagnostic tool: frame findings as observations worth the clinician's attention, never diagnoses or prescriptions.`;

async function buildRosterContext(
  currentPatientId: string | null,
): Promise<string> {
  const patients = await db.select().from(schema.patient);
  const sections: string[] = [];
  for (const p of patients) {
    let body: string;
    try {
      body = (await buildContext(p)).text;
    } catch {
      body = "Context unavailable (Terra fetch failed).";
    }
    const marker =
      p.id === currentPatientId ? " ⟵ CURRENTLY VIEWING" : "";
    sections.push(
      `### ${p.firstName} ${p.lastName}${marker}\n${body}`,
    );
  }
  return `# PATIENT ROSTER (${patients.length} patients)\n\n${sections.join("\n\n---\n\n")}`;
}

export async function chat(
  messages: ChatMessage[],
  currentPatientId: string | null,
): Promise<string> {
  const roster = await buildRosterContext(currentPatientId);
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: CHAT_SYSTEM },
      // Roster context is stable between data changes — cache it so
      // multi-turn conversations don't re-bill the whole prefix.
      { type: "text", text: roster, cache_control: { type: "ephemeral" } },
    ],
    messages,
  });
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to answer this question.");
  }
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
