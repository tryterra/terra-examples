/**
 * Terra data shapes, hand-written from the v6 TypeSpec models
 * (LabReports.tsp, TerraUser.tsp, Daily/Sleep/Body.tsp). Only the fields this
 * app reads are typed; everything upstream is an open enum, so all string
 * unions carry a `| (string & {})` escape hatch where unknown values are
 * expected. Optional fields are omitted (not null) unless noted.
 */

// ---------------------------------------------------------------------------
// Lab reports
// ---------------------------------------------------------------------------

/** Verbatim provenance — exactly what the report printed. */
export interface LabResultSource {
  name?: string;
  panel?: string;
  value?: string;
  units?: string;
  flag?: string;
  method?: string;
  notes?: string;
  reference_text?: string;
  collection_date?: string;
  collection_time?: string;
}

/** Normalised identity. `key === null` is the sole "no match" signal. */
export interface LabResultBiomarker {
  key: string | null;
  display_name?: string;
  loinc_code?: string;
  panel_id?: number;
  panel_key?: string;
  specimen?: string;
}

/** Exactly one typed value, named by `type`. */
export interface LabResultMeasurement {
  type: "numeric" | "bounded" | "qualitative" | "text" | "absent";
  numeric?: number;
  bounded?: { operator: "lt" | "gt"; value: number };
  qualitative?: { text?: string; code?: string };
  text?: string;
  absent_reason?: string;
  units?: string;
  ucum_code?: string;
}

export interface LabResultInterpretation {
  flag: string | null; // high | low | normal | ... (open enum)
  flag_raw?: string;
  source: "report" | "computed" | "none";
  applied_range?: { lower?: number; upper?: number };
}

export interface LabReferenceRangeContext {
  sex?: string;
  pregnancy_status?: string;
  cycle_phase?: string;
  reference_population?: string;
  age_lower?: number;
  age_upper?: number;
  gestational_week_lower?: number;
  gestational_week_upper?: number;
  modifiers?: string[];
}

export interface LabReferenceRange {
  lower?: number;
  upper?: number;
  type?: string; // normal | low | high | critical_low | ... (open enum)
  context?: LabReferenceRangeContext;
}

export interface LabReportResult {
  source: LabResultSource;
  biomarker: LabResultBiomarker;
  measurement: LabResultMeasurement;
  interpretation: LabResultInterpretation;
  reference_ranges?: LabReferenceRange[];
}

export interface LabReportPanel {
  id: number;
  name?: string;
  key?: string;
}

export interface LabReportStatusEntry {
  status: string;
  timestamp?: string;
  note?: string;
}

export type LabReportStatus =
  | "processing"
  | "processed"
  | "standardizing"
  | "standardized"
  | "sending"
  | "sent"
  | "partially_sent"
  | "retry_scheduled"
  | "retrying"
  | "failed"
  | "cancelled"
  | "deleted";

/** Statuses after which results exist and the session no longer changes. */
export const TERMINAL_LAB_STATUSES: ReadonlySet<string> = new Set([
  "standardized",
  "sending",
  "sent",
  "partially_sent",
  "failed",
  "cancelled",
]);

/** Statuses from which results are queryable. */
export const RESULTS_READY_STATUSES: ReadonlySet<string> = new Set([
  "standardized",
  "sending",
  "sent",
  "partially_sent",
]);

export interface LabReportSession {
  session_id: string; // snowflake as string — never Number()
  upload_id?: string;
  reference_id?: string;
  report_type?: string;
  current_status: LabReportStatus | (string & {});
  uploaded_at?: string;
  updated_at?: string;
  report_date?: string;
  report_time?: string;
  collection_date?: string;
  collection_time?: string;
  report_locale?: string;
  lab_name?: string;
  patient_age_at_collection?: number;
  patient_sex?: string;
  results_count?: number;
  file_count?: number;
  status_history?: LabReportStatusEntry[];
  /** Present only on the per-session GET, never on list responses. */
  results?: LabReportResult[];
  panels?: LabReportPanel[];
  report_notes?: string;
}

export interface LabReportListResponse {
  sessions: LabReportSession[];
}

export interface LabReportUploadResponse {
  upload_id: string;
  current_status: string;
}

export interface LabReportFilesResponse {
  files: Array<{ filename?: string; presigned_url: string }>;
  thumbnail?: string;
  expires_at?: string;
}

// ---------------------------------------------------------------------------
// Users / wearables
// ---------------------------------------------------------------------------

/** One provider connection. An end user (reference_id) can have several. */
export interface TerraUser {
  user_id: string;
  provider: string;
  created_at?: string | null;
  last_webhook_update?: string | null;
  scopes?: string | null;
  reference_id?: string | null;
  active?: boolean | null;
}

/** `GET /userInfo?reference_id=` → users; `?user_id=` → single user object. */
export interface UserInfoByReferenceResponse {
  users?: TerraUser[];
}

export interface WidgetSessionResponse {
  status?: string;
  url: string;
  session_id?: string;
  expires_in?: number;
}

// Wearable payloads — only the slices the dashboard extracts.

export interface HeartRateSummary {
  avg_hr_bpm?: number;
  max_hr_bpm?: number;
  min_hr_bpm?: number;
  resting_hr_bpm?: number;
  avg_hrv_rmssd?: number;
  avg_hrv_sdnn?: number;
}

export interface DailyPayload {
  metadata: { start_time: string; end_time?: string };
  heart_rate_data?: { summary?: HeartRateSummary };
  distance_data?: { steps?: number; distance_meters?: number };
  calories_data?: { total_burned_calories?: number };
  active_durations_data?: { activity_seconds?: number };
  stress_data?: { avg_stress_level?: number };
  /** Provider-native day scores (Whoop: recovery 0–100, sleep 0–100). */
  scores?: { recovery?: number; activity?: number; sleep?: number };
  data_enrichment?: Record<string, unknown>;
}

export interface SleepPayload {
  metadata: { start_time: string; end_time?: string; is_nap?: boolean };
  sleep_durations_data?: {
    asleep?: {
      duration_asleep_state_seconds?: number;
      duration_deep_sleep_state_seconds?: number;
      duration_light_sleep_state_seconds?: number;
      duration_REM_sleep_state_seconds?: number;
    };
    awake?: { duration_awake_state_seconds?: number };
    sleep_efficiency?: number;
  };
  heart_rate_data?: { summary?: HeartRateSummary };
  data_enrichment?: { sleep_score?: number; readiness_score?: number };
}

export interface BodyPayload {
  metadata: { start_time: string; end_time?: string };
  glucose_data?: {
    day_avg_blood_glucose_mg_per_dL?: number;
    time_in_range?: number;
  };
  blood_pressure_data?: {
    day_avg_systolic_bp?: number;
    day_avg_diastolic_bp?: number;
  };
  heart_data?: { heart_rate_data?: { summary?: HeartRateSummary } };
  oxygen_data?: { avg_saturation_percentage?: number };
  measurements_data?: { measurements?: Array<Record<string, unknown>> };
}

export interface ActivityPayload {
  metadata: {
    start_time: string;
    end_time?: string;
    name?: string;
    type?: number;
  };
  active_durations_data?: { activity_seconds?: number };
  calories_data?: { total_burned_calories?: number };
  heart_rate_data?: { summary?: HeartRateSummary };
  distance_data?: { steps?: number; distance_meters?: number };
}

export interface WearableDataResponse<T> {
  data?: T[];
  user?: TerraUser;
}
