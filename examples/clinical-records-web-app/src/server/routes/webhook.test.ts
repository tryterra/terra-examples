import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signTerraPayload } from "../lib/clinical/webhook-signature";
import { DEMO_RECORDS } from "../demo-fixtures";

const dir = mkdtempSync(path.join(tmpdir(), "clinical-webhook-"));
const SECRET = "whsec_route_test";
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.TERRA_WEBHOOK_SECRET = SECRET;
delete process.env.TERRA_DEV_ID;
delete process.env.TERRA_API_KEY;

const { migrateDb } = await import("../lib/db");
const { default: app } = await import("../index");

beforeAll(async () => {
  await migrateDb();
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const user = { user_id: "u-webhook", provider: "APPLE", reference_id: "ref-1" };
const records = DEMO_RECORDS["demo-3f2a9c1e-apple"].slice(0, 3);

function post(body: string, signature?: string) {
  return app.request("/api/webhook", {
    method: "POST",
    headers: signature ? { "terra-signature": signature } : {},
    body,
  });
}

describe("POST /api/webhook", () => {
  it("rejects an unsigned or badly signed request", async () => {
    const body = JSON.stringify({
      type: "clinical_record",
      user,
      data: records,
      version: "2022-03-16",
    });
    expect((await post(body)).status).toBe(401);
    expect((await post(body, signTerraPayload(body, "wrong"))).status).toBe(
      401,
    );
  });

  it("stores clinical_record events idempotently and serves them summarized", async () => {
    const body = JSON.stringify({
      type: "clinical_record",
      user,
      data: records,
      version: "2022-03-16",
    });
    for (let i = 0; i < 2; i++) {
      const res = await post(body, signTerraPayload(body, SECRET));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: true, stored: 3 });
    }
    const res = await app.request(`/api/users/${user.user_id}`);
    const json = (await res.json()) as {
      user: { referenceId: string; lastWebhookAt: string | null };
      records: Array<{
        record: { record_id: string };
        summary: { title: string };
      }>;
    };
    expect(json.user.referenceId).toBe("ref-1");
    expect(json.user.lastWebhookAt).not.toBeNull();
    expect(json.records).toHaveLength(3);
    expect(json.records.map((r) => r.summary.title)).toContain(
      "Hemoglobin A1c",
    );
  });

  it("never lets an older receipt overwrite a newer one", async () => {
    const newer = {
      ...records[0],
      display_name: "Newer",
      received_at: "2027-01-01T00:00:00Z",
    };
    const older = {
      ...records[0],
      display_name: "Older",
      received_at: "2020-01-01T00:00:00Z",
    };
    for (const rec of [newer, older]) {
      const body = JSON.stringify({
        type: "clinical_record",
        user,
        data: [rec],
        version: "2022-03-16",
      });
      expect((await post(body, signTerraPayload(body, SECRET))).status).toBe(
        200,
      );
    }
    const json = (await (
      await app.request(`/api/users/${user.user_id}`)
    ).json()) as {
      records: Array<{ record: { record_id: string; display_name: string } }>;
    };
    expect(
      json.records.find((r) => r.record.record_id === records[0].record_id)
        ?.record.display_name,
    ).toBe("Newer");
  });

  it("acknowledges unrelated event types without storing", async () => {
    const body = JSON.stringify({ type: "sleep", user, data: [] });
    const res = await post(body, signTerraPayload(body, SECRET));
    expect(await res.json()).toEqual({ received: true, ignored: "sleep" });
  });
});
