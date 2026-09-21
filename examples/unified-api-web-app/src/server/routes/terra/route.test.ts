import { describe, test, expect, vi, beforeEach, assert } from "vitest";
import { testClient } from "hono/testing";
import { Hono } from "hono";
import type { ExecutionContext } from "hono";
import type { Env } from "../../lib/auth";

/* ---------------------------------- Module mocks ---------------------------------- */

const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../../lib/db", () => ({
  createDb: vi.fn(() => mockDb),
}));

vi.mock("terra-api", () => ({
  verifyTerraWebhookSignature: vi.fn(),
  TerraClient: vi.fn(),
}));

vi.mock("../../lib/terra/webhook-handler", () => ({
  extractUserId: vi.fn(() => "tu-123"),
  markEvent: vi.fn(),
  processWebhookEvent: vi.fn(),
}));

vi.mock("../../lib/terra/sync-connections", () => ({
  syncTerraConnections: vi.fn(),
}));

vi.mock("../../lib/terra/client", () => ({
  createTerraClient: vi.fn(() => ({
    user: {
      getinfoforuserid: vi
        .fn()
        .mockResolvedValue({ users: [{ user_id: "tu-1" }] }),
    },
    authentication: {
      authenticateuser: vi
        .fn()
        .mockResolvedValue({ auth_url: "https://auth.example.com" }),
      deauthenticateuser: vi.fn().mockResolvedValue({}),
    },
  })),
  createTerraPublicClient: vi.fn(() => ({
    integrations: {
      detailedfetch: vi.fn().mockResolvedValue({
        providers: [{ provider: "FITBIT", name: "Fitbit" }],
      }),
    },
  })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuth: vi.fn((c: any, next: any) => {
    c.set("user", { id: "user-abc" });
    c.set("session", {});
    return next();
  }),
}));

const { verifyTerraWebhookSignature } = await import("terra-api");
const { processWebhookEvent, markEvent } =
  await import("../../lib/terra/webhook-handler");
const { syncTerraConnections } =
  await import("../../lib/terra/sync-connections");
const { createTerraClient, createTerraPublicClient } =
  await import("../../lib/terra/client");

/* ---------------------------------- App setup ---------------------------------- */

const terraRoutes = (await import("./route")).default;

const app = new Hono<{ Bindings: Env }>().route("/api/terra", terraRoutes);

const BASE_ENV: Partial<Env> = {
  DATABASE_URL: "postgres://test",
  TERRA_DEV_ID: "dev-1",
  TERRA_API_KEY: "key-1",
  TERRA_WEBHOOK_SECRET: "whsec-test",
};

const mockExecutionCtx: ExecutionContext = {
  waitUntil: vi.fn((p: Promise<unknown>) => p.catch(() => {})),
  passThroughOnException: vi.fn(),
  props: {},
};

const client = testClient(app, BASE_ENV as Env, mockExecutionCtx);

// Raw request helper for webhook tests (per-request env overrides + raw body)
function webhookRequest(init?: RequestInit, envOverrides?: Partial<Env>) {
  const env = { ...BASE_ENV, ...envOverrides } as Env;
  return app.request(
    "http://localhost/api/terra/webhook",
    init,
    env,
    mockExecutionCtx,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ---------------------------------- POST /webhook ---------------------------------- */

describe("POST /webhook", () => {
  const webhookBody = JSON.stringify({
    type: "activity",
    user: { user_id: "tu-123" },
    data: [],
  });
  const webhookHeaders = {
    "Content-Type": "application/json",
    "terra-signature": "valid-sig",
    "terra-reference": "ref-001",
  };

  function postWebhook(
    body = webhookBody,
    headers: Record<string, string> = webhookHeaders,
    envOverrides?: Partial<Env>,
  ) {
    return webhookRequest({ method: "POST", body, headers }, envOverrides);
  }

  test("returns 500 when webhook secret not configured", async () => {
    const res = await postWebhook(webhookBody, webhookHeaders, {
      TERRA_WEBHOOK_SECRET: "",
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Webhook secret not configured",
    });
  });

  test("returns 401 when terra-signature header missing", async () => {
    const { "terra-signature": _, ...noSig } = webhookHeaders;
    const res = await postWebhook(webhookBody, noSig);
    expect(res.status).toBe(401);
  });

  test("returns 401 when signature verification fails", async () => {
    vi.mocked(verifyTerraWebhookSignature).mockRejectedValueOnce(
      new Error("bad sig"),
    );
    const res = await postWebhook();
    expect(res.status).toBe(401);
  });

  test("returns 400 for invalid JSON body", async () => {
    vi.mocked(verifyTerraWebhookSignature).mockResolvedValueOnce(true);
    const res = await postWebhook("not json{{{", webhookHeaders);
    expect(res.status).toBe(400);
  });

  function mockDedupSelect(existing: { id: string } | null) {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(existing ? [existing] : []),
        }),
      }),
    });
  }

  function mockInsert(eventId: string) {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: eventId }]),
      }),
    });
  }

  test("returns 200 and processes valid webhook", async () => {
    vi.mocked(verifyTerraWebhookSignature).mockResolvedValueOnce(true);
    mockDedupSelect(null);
    mockInsert("evt-1");

    const res = await postWebhook();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(processWebhookEvent).toHaveBeenCalled();
  });

  test("returns 200 for duplicate delivery without processing", async () => {
    vi.mocked(verifyTerraWebhookSignature).mockResolvedValueOnce(true);
    mockDedupSelect({ id: "evt-existing" });

    const res = await postWebhook();
    expect(res.status).toBe(200);
    expect(processWebhookEvent).not.toHaveBeenCalled();
  });

  test("calls markEvent with failed when processWebhookEvent throws", async () => {
    vi.mocked(verifyTerraWebhookSignature).mockResolvedValueOnce(true);
    vi.mocked(processWebhookEvent).mockRejectedValueOnce(
      new Error("processing exploded"),
    );
    mockDedupSelect(null);
    mockInsert("evt-1");

    const res = await postWebhook();
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toBe(200);
    expect(markEvent).toHaveBeenCalledWith(
      expect.anything(),
      "evt-1",
      "failed",
      "processing exploded",
    );
  });

  test("archives payload to R2 when bucket configured", async () => {
    vi.mocked(verifyTerraWebhookSignature).mockResolvedValueOnce(true);
    mockDedupSelect(null);
    mockInsert("evt-1");

    const mockBucket = { put: vi.fn().mockResolvedValue(undefined) };
    const res = await webhookRequest(
      { method: "POST", body: webhookBody, headers: webhookHeaders },
      { TERRA_WEBHOOKS_BUCKET: mockBucket as any },
    );

    expect(res.status).toBe(200);
    expect(mockBucket.put).toHaveBeenCalledWith(
      expect.stringMatching(/^webhooks\/\d{4}\/\d{2}\/\d{2}\/.+\.json$/),
      webhookBody,
      expect.objectContaining({
        httpMetadata: { contentType: "application/json" },
      }),
    );
  });
});

/* ---------------------------------- GET /integrations ---------------------------------- */

describe("GET /integrations", () => {
  test("proxies Terra integrations response", async () => {
    const res = await client.api.terra.integrations.$get();
    assert(res.ok);
    const body = await res.json();
    expect(body.providers).toBeDefined();
  });

  test("returns 502 when Terra API fails", async () => {
    vi.mocked(createTerraPublicClient).mockReturnValueOnce({
      integrations: {
        detailedfetch: vi.fn().mockRejectedValue(new Error("upstream")),
      },
    } as any);

    const res = await client.api.terra.integrations.$get();
    expect(res.status).toBe(502);
  });
});

/* ---------------------------------- POST /auth ---------------------------------- */

describe("POST /auth", () => {
  test("returns auth URL for valid request", async () => {
    const res = await client.api.terra.auth.$post({
      json: { resource: "FITBIT" },
    });
    assert(res.ok);
    const body = await res.json();
    expect(body.auth_url).toBe("https://auth.example.com");
  });

  test("passes redirect URLs through to Terra client", async () => {
    const res = await client.api.terra.auth.$post({
      json: {
        resource: "GARMIN",
        authSuccessRedirectUrl: "https://app.example.com/success",
        authFailureRedirectUrl: "https://app.example.com/fail",
      },
    });
    expect(res.status).toBe(200);

    const terraClient = vi.mocked(createTerraClient).mock.results[0].value;
    expect(terraClient.authentication.authenticateuser).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "GARMIN",
        auth_success_redirect_url: "https://app.example.com/success",
        auth_failure_redirect_url: "https://app.example.com/fail",
      }),
    );
  });

  test("returns 400 for missing resource field", async () => {
    const res = await client.api.terra.auth.$post({
      json: {} as any,
    });
    expect(res.status).toBe(400);
  });
});

/* ---------------------------------- GET /connections ---------------------------------- */

describe("GET /connections", () => {
  test("returns empty list when user has no connections", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const res = await client.api.terra.connections.$get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connections: [] });
  });

  test("returns user connections list", async () => {
    const connections = [
      {
        id: "c1",
        terraUserId: "tu-1",
        provider: "FITBIT",
        scopes: null,
        status: "active",
        lastWebhookAt: null,
        connectedAt: new Date(),
      },
    ];
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(connections),
      }),
    });

    const res = await client.api.terra.connections.$get();
    assert(res.ok);
    const body = await res.json();
    expect(body.connections).toHaveLength(1);
    expect(body.connections[0].provider).toBe("FITBIT");
  });
});

/* ---------------------------------- POST /connections/sync ---------------------------------- */

describe("POST /connections/sync", () => {
  test("returns sync counts on success", async () => {
    vi.mocked(syncTerraConnections).mockResolvedValueOnce({
      synced: 2,
      revoked: 1,
    });

    const res = await client.api.terra.connections.sync.$post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ synced: 2, revoked: 1 });
  });

  test("returns 502 when sync fails", async () => {
    vi.mocked(syncTerraConnections).mockRejectedValueOnce(new Error("fail"));

    const res = await client.api.terra.connections.sync.$post();
    expect(res.status).toBe(502);
  });
});

/* ---------------------------------- DELETE /connections/:id ---------------------------------- */

describe("DELETE /connections/:id", () => {
  const CONN_ID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";

  test("returns 400 for non-UUID param", async () => {
    const res = await client.api.terra.connections[":id"].$delete({
      param: { id: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  test("returns 404 when connection not found", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const res = await client.api.terra.connections[":id"].$delete({
      param: { id: CONN_ID },
    });
    expect(res.status).toBe(404);
  });

  test("deauths and deletes connection on success", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([{ id: CONN_ID, terraUserId: "tu-1" }]),
        }),
      }),
    });
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await client.api.terra.connections[":id"].$delete({
      param: { id: CONN_ID },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDb.delete).toHaveBeenCalled();
  });

  test("returns 502 when Terra deauth fails", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([{ id: CONN_ID, terraUserId: "tu-1" }]),
        }),
      }),
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    vi.mocked(createTerraClient).mockReturnValueOnce({
      user: {
        getinfoforuserid: vi
          .fn()
          .mockResolvedValue({ users: [{ user_id: "tu-1" }] }),
      },
      authentication: {
        deauthenticateuser: vi.fn().mockRejectedValue(new Error("fail")),
      },
    } as any);

    const res = await client.api.terra.connections[":id"].$delete({
      param: { id: CONN_ID },
    });
    expect(res.status).toBe(502);
  });
});

/* ---------------------------------- GET /dashboard ---------------------------------- */

describe("GET /dashboard", () => {
  function mockConnectionsQuery(
    connections: { id: string; provider?: string }[],
  ) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(connections),
      }),
    };
  }

  function mockDataQuery(rows: unknown[]) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    };
  }

  test("returns connected: false when no active connections", async () => {
    mockDb.select.mockReturnValueOnce(mockConnectionsQuery([]));

    const res = await client.api.terra.dashboard.$get({ query: {} });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      connections: [],
      scores: null,
      biomarkers: null,
    });
  });

  test("returns latest data across active connections", async () => {
    const today = new Date();
    today.setHours(6, 0, 0, 0);

    const sleepRow = {
      terraConnectionId: "c1",
      startTime: today,
      endTime: new Date(today.getTime() + 8 * 3600_000),
      sleepScore: 85,
      sleepScoreV2: null,
      readinessScore: null,
      respiratoryScoreV2: null,
    };
    const dailyRow = {
      terraConnectionId: "c1",
      date: new Date().toISOString().slice(0, 10),
      steps: 8500,
      restingHrBpm: 58,
      avgHrvSdnn: 45,
      vo2max: 42,
      activeSeconds: 5400,
      totalStressScore: 40,
      totalStressScoreV2: null,
      strainIndex: null,
      strainTrafficLight: null,
      resilienceScore: null,
      cardiovascularScore: null,
      immuneIndex: null,
      respiratoryScore: null,
      stressContributors: null,
      strainContributors: null,
    };

    mockDb.select
      .mockReturnValueOnce(
        mockConnectionsQuery([
          { id: "c1", provider: "GARMIN" },
          { id: "c2", provider: "GOOGLE" },
        ]),
      )
      .mockReturnValueOnce(mockDataQuery([sleepRow]))
      .mockReturnValueOnce(mockDataQuery([dailyRow]));

    const res = await client.api.terra.dashboard.$get({ query: {} });
    assert(res.ok);
    const body = await res.json();
    assert(body.connected);
    expect(body.scores?.sleep?.sleep_score).toBe(85);
    expect(body.scores?.daily?.total_stress_score).toBe(40);
    expect(body.biomarkers.steps?.value).toBe(8500);
    expect(body.biomarkers.rhr?.value).toBe(58);
  });

  test("returns null for empty data tables with active connections", async () => {
    mockDb.select
      .mockReturnValueOnce(
        mockConnectionsQuery([{ id: "c1", provider: "GARMIN" }]),
      )
      .mockReturnValueOnce(mockDataQuery([]))
      .mockReturnValueOnce(mockDataQuery([]));

    const res = await client.api.terra.dashboard.$get({ query: {} });
    assert(res.ok);
    const body = await res.json();
    assert(body.connected);
    expect(body.scores).toBeNull();
    expect(body.biomarkers.steps).toBeNull();
  });
});
