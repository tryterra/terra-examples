import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyVantageSignature } from "./webhook-signature";

const SECRET = "test-signing-secret";
const BODY =
  '{"event_type":"order.status_changed","event_id":"338124064228737024"}';

function sign(body: string, t: number, secret = SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyVantageSignature", () => {
  const now = 1_763_661_470;
  const clock = { now: () => now };

  it("accepts a valid, fresh signature", () => {
    expect(
      verifyVantageSignature(BODY, sign(BODY, now - 10), SECRET, clock),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifyVantageSignature(BODY + " ", sign(BODY, now - 10), SECRET, clock),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(
      verifyVantageSignature(
        BODY,
        sign(BODY, now - 10, "other"),
        SECRET,
        clock,
      ),
    ).toBe(false);
  });

  it("rejects a stale timestamp (t is SECONDS — outside the 5-minute window)", () => {
    expect(
      verifyVantageSignature(BODY, sign(BODY, now - 301), SECRET, clock),
    ).toBe(false);
  });

  it("rejects a millisecond timestamp — the classic integration bug", () => {
    expect(
      verifyVantageSignature(BODY, sign(BODY, now * 1000), SECRET, clock),
    ).toBe(false);
  });

  it("rejects missing or malformed headers without throwing", () => {
    expect(verifyVantageSignature(BODY, undefined, SECRET, clock)).toBe(false);
    expect(verifyVantageSignature(BODY, "t=abc,v1=", SECRET, clock)).toBe(
      false,
    );
    expect(verifyVantageSignature(BODY, "garbage", SECRET, clock)).toBe(false);
  });
});
