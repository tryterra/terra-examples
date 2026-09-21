import { describe, test, expect, vi, beforeEach } from "vitest";
import { requestBackfill } from "./backfill";

function createMockClient(providerTypes?: Record<string, boolean>) {
  const makeFetch = () => ({ fetch: vi.fn().mockResolvedValue({}) });
  return {
    activity: makeFetch(),
    sleep: makeFetch(),
    body: makeFetch(),
    daily: makeFetch(),
    nutrition: makeFetch(),
    menstruation: makeFetch(),
    integrations: {
      detailedfetch: vi.fn().mockResolvedValue({
        providers: [{ provider: "FITBIT", types: providerTypes }],
      }),
    },
  };
}

const TERRA_USER_ID = "tu-999";

describe("requestBackfill", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient({
      activity: true,
      sleep: true,
      body: true,
      daily: true,
      nutrition: true,
      menstruation: true,
    });
  });

  test("calls fetch on all supported data types", async () => {
    await requestBackfill(client as any, TERRA_USER_ID, "FITBIT");

    for (const resource of [
      "activity",
      "sleep",
      "body",
      "daily",
      "nutrition",
      "menstruation",
    ] as const) {
      expect(client[resource].fetch).toHaveBeenCalledOnce();
    }
  });

  test("passes correct user_id to each fetch", async () => {
    await requestBackfill(client as any, TERRA_USER_ID, "FITBIT");

    for (const resource of [
      "activity",
      "sleep",
      "body",
      "daily",
      "nutrition",
      "menstruation",
    ] as const) {
      const args = client[resource].fetch.mock.calls[0][0];
      expect(args.user_id).toBe(TERRA_USER_ID);
    }
  });

  test("start_date is approximately 30 days ago in unix seconds", async () => {
    await requestBackfill(client as any, TERRA_USER_ID, "FITBIT");

    const args = client.activity.fetch.mock.calls[0][0];
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
    expect(args.start_date).toBeGreaterThanOrEqual(thirtyDaysAgo - 2);
    expect(args.start_date).toBeLessThanOrEqual(thirtyDaysAgo + 2);
  });

  test("does not throw when individual fetches fail", async () => {
    client.activity.fetch.mockRejectedValue(new Error("provider down"));
    client.sleep.fetch.mockRejectedValue(new Error("timeout"));

    await expect(
      requestBackfill(client as any, TERRA_USER_ID, "FITBIT"),
    ).resolves.not.toThrow();

    expect(client.body.fetch).toHaveBeenCalledOnce();
    expect(client.daily.fetch).toHaveBeenCalledOnce();
  });

  test("only fetches data types supported by the provider", async () => {
    client = createMockClient({
      sleep: true,
      body: true,
      daily: true,
    });

    await requestBackfill(client as any, TERRA_USER_ID, "FITBIT");

    expect(client.sleep.fetch).toHaveBeenCalledOnce();
    expect(client.body.fetch).toHaveBeenCalledOnce();
    expect(client.daily.fetch).toHaveBeenCalledOnce();
    expect(client.activity.fetch).not.toHaveBeenCalled();
    expect(client.nutrition.fetch).not.toHaveBeenCalled();
    expect(client.menstruation.fetch).not.toHaveBeenCalled();
  });

  test("falls back to all types when integrations lookup fails", async () => {
    client.integrations.detailedfetch.mockRejectedValue(new Error("API error"));

    await requestBackfill(client as any, TERRA_USER_ID, "FITBIT");

    for (const resource of [
      "activity",
      "sleep",
      "body",
      "daily",
      "nutrition",
      "menstruation",
    ] as const) {
      expect(client[resource].fetch).toHaveBeenCalledOnce();
    }
  });

  test("falls back to all types when provider not found", async () => {
    await requestBackfill(client as any, TERRA_USER_ID, "UNKNOWN");

    for (const resource of [
      "activity",
      "sleep",
      "body",
      "daily",
      "nutrition",
      "menstruation",
    ] as const) {
      expect(client[resource].fetch).toHaveBeenCalledOnce();
    }
  });
});
