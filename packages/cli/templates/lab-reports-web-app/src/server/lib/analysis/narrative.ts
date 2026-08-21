/**
 * Narrative assembly: deterministic sentences from scored contributions.
 * Pure string templates — the same findings always read the same way, and
 * every sentence traces back to a visible contribution row.
 */
import type { Contribution, DomainScore } from "./scoring";

/** Canned lab×wearable pairings, one per domain where both sides can fire. */
const COMBINATORS: Record<
  string,
  { when: (lab: Contribution, wear: Contribution) => boolean; text: string }
> = {
  metabolic: {
    when: () => true,
    text: "Lab glucose markers and day-to-day glucose control point the same way - worth reviewing together.",
  },
  cardiovascular: {
    when: () => true,
    text: "Lipid results alongside daily cardiovascular load give a fuller risk picture than either alone.",
  },
  recovery: {
    when: () => true,
    text: "Recovery physiology from the wearable adds daily context to these lab findings.",
  },
};

function labSentence(c: Contribution): string {
  if (c.severity === "normal") {
    return c.guideline
      ? `${c.label} is in the typical range at ${c.valueText}.`
      : `${c.label} is within range at ${c.valueText}.`;
  }
  if (c.guideline && !c.flag) {
    // No range on the report — judged against standard guideline cutoffs.
    const judgement =
      c.severity === "mild" ? "borderline" : "well outside typical cutoffs";
    return `${c.label} is ${judgement} at ${c.valueText} (guideline cutoffs; the report printed no range).`;
  }
  const direction = c.flag ? c.flag.replaceAll("_", " ") : "out of range";
  const reference = c.detailText ? ` (reference ${c.detailText}` : "";
  const provenance = c.provenance
    ? `${reference ? ", " : " ("}${c.provenance})`
    : reference
      ? ")"
      : "";
  return `${c.label} is ${direction} at ${c.valueText}${reference}${provenance}.`;
}

function wearableSentence(c: Contribution): string {
  const judgement =
    c.severity === "normal"
      ? "which looks healthy"
      : c.severity === "mild"
        ? "which has room to improve"
        : "which needs attention";
  return `${c.label} averaged ${c.valueText} over the ${c.detailText}, ${judgement}.`;
}

/** Up to `limit` sentences for one domain, worst findings first. */
export function domainNarrative(domain: DomainScore, limit = 3): string[] {
  const rank: Record<Contribution["severity"], number> = {
    marked: 0,
    mild: 1,
    normal: 2,
  };
  const ordered = [...domain.contributions].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.subscore - b.subscore,
  );
  const sentences = ordered
    .slice(0, limit)
    .map((c) => (c.kind === "lab" ? labSentence(c) : wearableSentence(c)));

  const combinator = COMBINATORS[domain.key];
  if (combinator) {
    const lab = ordered.find((c) => c.kind === "lab" && c.severity !== "normal");
    const wear = ordered.find(
      (c) => c.kind === "wearable" && c.severity !== "normal",
    );
    if (lab && wear && combinator.when(lab, wear)) {
      sentences.push(combinator.text);
    }
  }
  return sentences;
}

/** One-paragraph overall summary across all domains. */
export function overallNarrative(domains: DomainScore[]): string {
  const scored = domains.filter((d) => d.score != null);
  if (scored.length === 0) {
    return "Not enough data yet - upload a lab report or connect a wearable to generate an assessment.";
  }
  const poor = scored.filter((d) => d.status === "Poor").map((d) => d.label);
  const fair = scored.filter((d) => d.status === "Fair").map((d) => d.label);
  const good = scored.filter((d) => d.status === "Good").map((d) => d.label);

  const parts: string[] = [];
  if (good.length > 0) {
    parts.push(`${listWords(good)} ${good.length === 1 ? "looks" : "look"} good`);
  }
  if (fair.length > 0) {
    parts.push(
      `${listWords(fair)} ${fair.length === 1 ? "shows" : "show"} room to improve`,
    );
  }
  if (poor.length > 0) {
    parts.push(`${listWords(poor)} ${poor.length === 1 ? "needs" : "need"} attention`);
  }
  return (
    capitalizeFirst(parts.join("; ")) +
    ". Scores are computed deterministically from the values shown below - this is decision support, not a diagnosis."
  );
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
