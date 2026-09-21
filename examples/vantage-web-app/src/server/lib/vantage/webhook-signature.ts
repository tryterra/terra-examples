/**
 * Vantage webhook signature verification — self-contained, node:crypto only.
 *
 * Header: `X-Terra-Signature: t=<unix_seconds>,v1=<hex>` where
 * v1 = HMAC-SHA256(signing_secret, `${t}.${rawBody}`).
 *
 * Gotchas this encodes so you don't rediscover them:
 * - `t` is Unix SECONDS (not milliseconds — a millisecond comparison rejects
 *   every genuine webhook).
 * - The HMAC covers the RAW request body bytes. Verify before any JSON parse;
 *   re-serializing the payload changes whitespace/key order and breaks it.
 * - Compare with a constant-time function.
 *
 * If you already use the terra-api SDK for the Unified API, its
 * verifyTerraWebhookSignature covers the same scheme.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_TOLERANCE_SECONDS = 300;

/** Verify a Vantage webhook. Returns true only for a fresh, valid signature. */
export function verifyVantageSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  signingSecret: string,
  opts: { toleranceSeconds?: number; now?: () => number } = {},
): boolean {
  if (!signatureHeader) return false;
  const parts = new Map(
    signatureHeader
      .split(",")
      .filter((p) => p.includes("="))
      .map((p) => p.split("=", 2) as [string, string]),
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

  const expected = createHmac("sha256", signingSecret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
