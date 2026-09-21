/** Formatting helpers shared by both personas. */

const CURRENCY_CODES: Record<number, string> = {
  840: "USD",
  978: "EUR",
  826: "GBP",
};

/** Integer cents + ISO-4217 numeric → localized money. */
export function formatPrice(
  cents: number | undefined,
  isoNumeric: number | undefined,
): string {
  if (cents === undefined) return "—";
  const currency = CURRENCY_CODES[isoNumeric ?? 840] ?? "USD";
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    cents / 100,
  );
}

export function formatRelativeTime(iso: string | Date | undefined): string {
  if (!iso) return "—";
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.round((Date.now() - then.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
