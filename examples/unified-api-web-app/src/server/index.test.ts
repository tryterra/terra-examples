import { describe, test, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("./lib/db", () => ({
  createDb: vi.fn(),
}));

vi.mock("./lib/terra/client", () => ({
  createTerraClient: vi.fn(() => ({})),
}));

vi.mock("./lib/terra/sync-connections", () => ({
  syncTerraConnections: vi.fn(),
}));

vi.mock("hono-agents", () => ({
  agentsMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
}));
vi.mock("./agents/chat-agent", () => ({ ChatAgent: class {} }));
vi.mock("./routes/auth", () => ({ default: new Hono() }));
vi.mock("./routes/chat", () => ({ default: new Hono() }));
vi.mock("./routes/health", () => ({ default: new Hono() }));
vi.mock("./routes/onboarding", () => ({ default: new Hono() }));
vi.mock("./routes/users", () => ({ default: new Hono() }));
vi.mock("./routes/terra/route", () => ({ default: new Hono() }));

const { createDb } = await import("./lib/db");
const { syncTerraConnections } = await import("./lib/terra/sync-connections");

const worker = (await import("./index")).default;

function makeEnv() {
  return {
    DATABASE_URL: "postgres://test",
    BETTER_AUTH_SECRET: "secret",
    TERRA_DEV_ID: "dev-1",
    TERRA_API_KEY: "key-1",
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createDb).mockReturnValue({
    selectDistinct: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as any);
});

describe("scheduled handler", () => {
  test("syncs each user with active connections", async () => {
    vi.mocked(createDb).mockReturnValue({
      selectDistinct: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]),
        }),
      }),
    } as any);
    vi.mocked(syncTerraConnections).mockResolvedValue({
      synced: 1,
      revoked: 0,
    });

    let waitUntilPromise: Promise<unknown> | undefined;
    const ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waitUntilPromise = p;
      }),
      passThroughOnException: vi.fn(),
    };

    worker.scheduled({} as any, makeEnv(), ctx as any);
    await waitUntilPromise;

    expect(syncTerraConnections).toHaveBeenCalledTimes(2);
    expect(vi.mocked(syncTerraConnections).mock.calls[0][2]).toBe("u1");
    expect(vi.mocked(syncTerraConnections).mock.calls[1][2]).toBe("u2");
  });

  test("continues syncing when one user fails", async () => {
    vi.mocked(createDb).mockReturnValue({
      selectDistinct: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]),
        }),
      }),
    } as any);
    vi.mocked(syncTerraConnections)
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ synced: 1, revoked: 0 });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let waitUntilPromise: Promise<unknown> | undefined;
    const ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waitUntilPromise = p;
      }),
      passThroughOnException: vi.fn(),
    };

    worker.scheduled({} as any, makeEnv(), ctx as any);
    await waitUntilPromise;

    expect(syncTerraConnections).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("u1"),
      expect.any(Error),
    );
  });

  test("handles empty user list", async () => {
    let waitUntilPromise: Promise<unknown> | undefined;
    const ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waitUntilPromise = p;
      }),
      passThroughOnException: vi.fn(),
    };

    worker.scheduled({} as any, makeEnv(), ctx as any);
    await waitUntilPromise;

    expect(syncTerraConnections).not.toHaveBeenCalled();
  });
});
