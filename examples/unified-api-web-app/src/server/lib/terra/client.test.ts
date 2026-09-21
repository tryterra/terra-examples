import { describe, test, expect, vi } from "vitest";
import { createTerraClient, createTerraPublicClient } from "./client";
import type { Env } from "../auth";

vi.mock("terra-api", () => {
  const TerraClient = vi.fn();
  return { TerraClient };
});

const { TerraClient } = await import("terra-api");

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DATABASE_URL: "postgres://test",
    BETTER_AUTH_SECRET: "secret",
    TERRA_DEV_ID: "dev-123",
    TERRA_API_KEY: "key-456",
    TERRA_WEBHOOK_SECRET: "whsec-789",
    ...overrides,
  } as Env;
}

describe("createTerraClient", () => {
  test("creates client with devId, apiKey, and base URL", () => {
    createTerraClient(makeEnv());
    expect(TerraClient).toHaveBeenCalledWith({
      devId: "dev-123",
      apiKey: "key-456",
      baseUrl: "https://access.tryterra.co/api/v2",
    });
  });

  test("throws when TERRA_DEV_ID missing", () => {
    expect(() => createTerraClient(makeEnv({ TERRA_DEV_ID: "" }))).toThrow(
      "Terra API credentials not configured",
    );
  });

  test("throws when TERRA_API_KEY missing", () => {
    expect(() => createTerraClient(makeEnv({ TERRA_API_KEY: "" }))).toThrow(
      "Terra API credentials not configured",
    );
  });
});

describe("createTerraPublicClient", () => {
  test("creates client with devId only", () => {
    createTerraPublicClient(makeEnv());
    expect(TerraClient).toHaveBeenCalledWith({ devId: "dev-123" });
  });

  test("throws when TERRA_DEV_ID missing", () => {
    expect(() =>
      createTerraPublicClient(makeEnv({ TERRA_DEV_ID: "" })),
    ).toThrow("TERRA_DEV_ID not configured");
  });
});
