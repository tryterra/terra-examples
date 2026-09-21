import type { Icon } from "@phosphor-icons/react";
import { BatteryChargingIcon } from "@phosphor-icons/react/BatteryCharging";
import { BrainIcon } from "@phosphor-icons/react/Brain";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { MoonIcon } from "@phosphor-icons/react/Moon";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { WindIcon } from "@phosphor-icons/react/Wind";
import type { ScoreField } from "./types";

/* -------------------------------------------------------------------------- */
/*                                   Scores                                   */
/* -------------------------------------------------------------------------- */

/** Maps Terra data_enrichment score fields to display labels. */
export const SCORE_DISPLAY: Partial<
  Record<ScoreField, { title: string; description: string }>
> = {
  sleep_score: {
    title: "Sleep",
    description:
      "Your sleep restoration score based on duration, efficiency, and timing.",
  },
  sleep_score_v2: {
    title: "Sleep",
    description:
      "Your sleep restoration score based on duration, efficiency, and timing.",
  },
  total_stress_score: {
    title: "Stress",
    description:
      "Your stress level based on heart rate variability and recovery indicators.",
  },
  total_stress_score_v2: {
    title: "Stress",
    description:
      "Your stress level based on heart rate variability and recovery indicators.",
  },
  readiness_score: {
    title: "Readiness",
    description:
      "Your body's readiness for the day based on recovery, resilience, and HRV.",
  },
  resilience_score: {
    title: "Resilience",
    description:
      "How well your body adapts to and recovers from physical and mental stress.",
  },
  respiratory_score: {
    title: "Respiratory",
    description:
      "Your respiratory health score based on breathing rate and blood oxygen.",
  },
  respiratory_score_v2: {
    title: "Respiratory",
    description:
      "Your respiratory health score based on breathing rate and blood oxygen.",
  },
  strain_index: {
    title: "Strain",
    description: "Your training load and physical strain index.",
  },
};

/* -------------------------------------------------------------------------- */
/*                            Customizable scores                             */
/* -------------------------------------------------------------------------- */

export interface CustomizableScore {
  key: string;
  title: string;
  icon: Icon;
  description: string;
  terraFields: ScoreField[];
}

export const CUSTOMIZABLE_SCORES: CustomizableScore[] = [
  {
    key: "sleep",
    title: "Sleep",
    icon: MoonIcon,
    description:
      "Your sleep restoration score based on duration, efficiency, and timing.",
    terraFields: ["sleep_score_v2", "sleep_score"],
  },
  {
    key: "stress",
    title: "Stress",
    icon: BrainIcon,
    description:
      "Your stress level based on heart rate variability and recovery indicators.",
    terraFields: ["total_stress_score_v2", "total_stress_score"],
  },
  {
    key: "readiness",
    title: "Readiness",
    icon: BatteryChargingIcon,
    description:
      "Your body's readiness for the day based on recovery, resilience, and HRV.",
    terraFields: ["readiness_score"],
  },
  {
    key: "strain",
    title: "Strain",
    icon: LightningIcon,
    description: "Your training load and physical strain index.",
    terraFields: ["strain_index"],
  },
  {
    key: "resilience",
    title: "Resilience",
    icon: ShieldCheckIcon,
    description:
      "How well your body adapts to and recovers from physical and mental stress.",
    terraFields: ["resilience_score"],
  },
  {
    key: "respiratory",
    title: "Respiratory",
    icon: WindIcon,
    description:
      "Your respiratory health score based on breathing rate and blood oxygen.",
    terraFields: ["respiratory_score_v2", "respiratory_score"],
  },
];
