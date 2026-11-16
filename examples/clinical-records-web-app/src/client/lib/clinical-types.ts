/** Display metadata per clinical_type. Unknown types get a generic entry. */
import {
  BandaidsIcon,
  FileTextIcon,
  FirstAidKitIcon,
  FlaskIcon,
  HeartbeatIcon,
  type Icon,
  IdentificationCardIcon,
  PillIcon,
  ShieldPlusIcon,
  StethoscopeIcon,
  SyringeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

export interface TypeMeta {
  label: string;
  icon: Icon;
}

/** Display order: the things a clinician scans first come first. */
const TYPES: Array<[string, TypeMeta]> = [
  ["lab_result", { label: "Lab results", icon: FlaskIcon }],
  ["vital_sign", { label: "Vitals", icon: HeartbeatIcon }],
  ["condition", { label: "Conditions", icon: StethoscopeIcon }],
  ["medication", { label: "Medications", icon: PillIcon }],
  ["allergy", { label: "Allergies", icon: WarningCircleIcon }],
  ["immunization", { label: "Immunizations", icon: SyringeIcon }],
  ["procedure", { label: "Procedures", icon: BandaidsIcon }],
  ["clinical_note", { label: "Clinical notes", icon: FileTextIcon }],
  ["coverage", { label: "Coverage", icon: IdentificationCardIcon }],
];

const BY_TYPE = new Map(TYPES);
export const TYPE_ORDER = TYPES.map(([t]) => t);

export function typeMeta(type: string): TypeMeta {
  return (
    BY_TYPE.get(type) ?? {
      label: type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      icon: type ? FirstAidKitIcon : ShieldPlusIcon,
    }
  );
}

export function compareTypes(a: string, b: string): number {
  const ia = TYPE_ORDER.indexOf(a);
  const ib = TYPE_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
}
