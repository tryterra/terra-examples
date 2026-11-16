import { describe, expect, it } from "vitest";
import { signTerraPayload, verifyTerraSignature } from "./webhook-signature";

const body = '{"type":"clinical_record","data":[]}';
const secret = "whsec_test";

describe("verifyTerraSignature", () => {
  it("accepts a fresh valid signature", () => {
    expect(
      verifyTerraSignature(body, signTerraPayload(body, secret), secret),
    ).toBe(true);
  });
  it("rejects a tampered body, wrong secret, missing header", () => {
    const sig = signTerraPayload(body, secret);
    expect(verifyTerraSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyTerraSignature(body, sig, "other")).toBe(false);
    expect(verifyTerraSignature(body, undefined, secret)).toBe(false);
    expect(verifyTerraSignature(body, "garbage", secret)).toBe(false);
  });
  it("rejects stale timestamps (seconds, not milliseconds)", () => {
    const sig = signTerraPayload(
      body,
      secret,
      Math.floor(Date.now() / 1000) - 3600,
    );
    expect(verifyTerraSignature(body, sig, secret)).toBe(false);
  });
});
