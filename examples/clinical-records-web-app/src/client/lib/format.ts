/** Formatting helpers. */

export function formatRelativeTime(
  iso: string | Date | null | undefined,
): string {
  if (!iso) return "-";
  const then = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(then.getTime())) return "-";
  const s = Math.round((Date.now() - then.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/**
 * FHIR dates come as "2026", "2026-05", "2026-05-12", or a full dateTime.
 * Render at the precision given; never invent a day the source did not send.
 */
export function formatClinicalDate(value: string | null | undefined): string {
  if (!value) return "-";
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const d = new Date(`${value}-01T00:00:00`);
    return Number.isNaN(d.getTime())
      ? value
      : new Intl.DateTimeFormat("en", {
          month: "short",
          year: "numeric",
        }).format(d);
  }
  // Date-only: parse as local midnight so the day does not shift by timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
