/**
 * Terra webhook signature verification - self-contained, node:crypto only.
 *
 * Header: `terra-signature: t=<unix_seconds>,v1=<hex>` where
 * v1 = HMAC-SHA256(signing_secret, `${t}.${rawBody}`).
 *
 * - `t` is Unix SECONDS.
 * - The HMAC covers the RAW request body. Verify before JSON parsing;
 *   re-serializing changes whitespace and key order and breaks it.
 * - Compare in constant time.
 *
 * The terra-api SDK's verifyTerraWebhookSignature implements the same scheme.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_TOLERANCE_SECONDS = 300;

export function signTerraPayload(
  rawBody: string,
  secret: string,
  t = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return `t=${t},v1=${v1}`;
}

/** True only for a fresh, valid signature. */
export function verifyTerraSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  opts: { toleranceSeconds?: number; now?: () => number } = {},
): boolean {
  if (!signatureHeader) return false;
  const parts = new Map(
    signatureHeader
      .split(",")
      .filter((p) => p.includes("="))
      .map((p) => p.trim().split("=", 2) as [string, string]),
  );
  const t = Number(parts.get("t"));
  const received = parts.get("v1");
  if (!Number.isFinite(t) || !received) return false;

  const nowSeconds = (opts.now ?? (() => Date.now() / 1000))();
  if (
    Math.abs(nowSeconds - t) >
    (opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)
  )
    return false;

  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
