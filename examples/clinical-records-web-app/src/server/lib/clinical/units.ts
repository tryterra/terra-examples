/**
 * UCUM units as people read them. Health systems send UCUM codes ("Cel",
 * "10*3/uL", "mm[Hg]") or half-formatted strings ("kg/m^2"); clinicians
 * expect "°C", "×10³/µL", "mmHg". Unknown units pass through untouched.
 */

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

function superscript(digits: string): string {
  return [...digits].map((c) => SUPERSCRIPT[c] ?? c).join("");
}

/** Whole-unit replacements, matched case-sensitively (UCUM is). */
const EXACT: Record<string, string> = {
  Cel: "°C",
  "[degF]": "°F",
  "[lb_av]": "lb",
  "[in_i]": "in",
  "[ft_i]": "ft",
  "[oz_av]": "oz",
  "mm[Hg]": "mmHg",
  "[iU]": "IU",
  "[IU]": "IU",
  "/min": "/min",
  "{beats}/min": "bpm",
  "{breaths}/min": "breaths/min",
};

export interface PrettyUnitOptions {
  /** Per-minute counts on a heart-rate observation read as "bpm". */
  heartRate?: boolean;
}

export function prettyUnit(
  unit: string | null | undefined,
  opts: PrettyUnitOptions = {},
): string | null {
  if (!unit) return null;
  const raw = unit.trim();
  // Pure UCUM annotations ("{cells}", "{score}") carry no unit at all.
  if (raw === "" || /^\{[^}]*\}$/.test(raw)) return null;
  if (opts.heartRate && /^(\{beats\})?\/min$/i.test(raw)) return "bpm";
  if (EXACT[raw]) return EXACT[raw];

  return (
    raw
      // 10*3/uL, 10^9/L -> ×10³/µL, ×10⁹/L
      .replace(/^10[*^](-?\d+)/, (_, exp: string) => `×10${superscript(exp)}`)
      // kg/m2, kg/m^2 -> kg/m²; also cm2, m3 (meters only, so cmH2O stays).
      .replace(
        /(m)\^?([23])(?![\d])/g,
        (_, u: string, p: string) => `${u}${superscript(p)}`,
      )
      // micro: uL, ug, umol, uIU -> µL, µg, µmol, µIU
      .replace(/(^|[/(×³⁶⁹\s])u(?=[A-Za-z])/g, "$1µ")
      // Remaining annotations: "mg/{total}" -> "mg"
      .replace(/\/?\{[^}]*\}/g, "")
      .replace(/\[([^\]]+)\]/g, "$1")
      .trim() || null
  );
}
