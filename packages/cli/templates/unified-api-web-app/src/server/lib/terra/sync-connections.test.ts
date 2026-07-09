import { describe, test, expect, vi } from "vitest";
import { parseScopes, syncTerraConnections } from "./sync-connections";
import { createMockDb } from "../db.test-utils";
import { terraConnection } from "../../../../db/schema";

describe("parseScopes", () => {
  test.each([
    [undefined, null],
    ["", null],
    ["  ", null],
    [",,,", null],
    ["activity", ["activity"]],
    ["activity,sleep", ["activity", "sleep"]],
    ["activity, sleep , body", ["activity", "sleep", "body"]],
  ])("parseScopes(%j) returns %j", (input, expected) => {
    expect(parseScopes(input)).toEqual(expected);
  });
});

describe("syncTerraConnections", () => {
  function makeTerraUser(overrides: Record<string, unknown> = {}) {
    return {
      user_id: "tu-1",
      provider: "FITBIT",
      active: true,
      scopes: "activity,sleep",
      ...overrides,
    };
  }

  function makeMockClient(users: unknown[] = []) {
    return {
      user: {
        getinfoforuserid: vi.fn().mockResolvedValue({ users }),
      },
    } as any;
  }

  test("upserts connections and returns correct counts", async () => {
    const db = createMockDb();
    const client = makeMockClient([
      makeTerraUser({ user_id: "tu-1", active: true }),
      makeTerraUser({ user_id: "tu-2", active: false, provider: "GARMIN" }),
    ]);

    db._chains.insert.returning.mockResolvedValue([{ lastWebhookAt: null }]);

    const staleWhere = { returning: vi.fn().mockResolvedValue([]) };
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockReturnValue(staleWhere),
    });

    const result = await syncTerraConnections(db, client, "user-abc");

    expect(result).toEqual({ synced: 1, revoked: 1 });
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(client.user.getinfoforuserid).toHaveBeenCalledWith({
      reference_id: "user-abc",
    });
  });

  test("returns zeros when Terra returns no users", async () => {
    const db = createMockDb();
    const client = makeMockClient([]);

    const result = await syncTerraConnections(db, client, "user-abc");

    expect(result).toEqual({ synced: 0, revoked: 0 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  test("returns zeros when response has no users key", async () => {
    const db = createMockDb();
    const client = {
      user: {
        getinfoforuserid: vi.fn().mockResolvedValue({}),
      },
    } as any;

    const result = await syncTerraConnections(db, client, "user-abc");

    expect(result).toEqual({ synced: 0, revoked: 0 });
  });

  test("propagates error when Terra API call fails", async () => {
    const db = createMockDb();
    const client = {
      user: {
        getinfoforuserid: vi.fn().mockRejectedValue(new Error("API timeout")),
      },
    } as any;

    await expect(syncTerraConnections(db, client, "user-abc")).rejects.toThrow(
      "API timeout",
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  test("marks stale active connections as revoked", async () => {
    const db = createMockDb();
    const client = makeMockClient([
      makeTerraUser({ user_id: "tu-1", active: true }),
    ]);

    db._chains.insert.returning.mockResolvedValue([{ lastWebhookAt: null }]);

    const staleReturning = vi.fn().mockResolvedValue([{ id: "stale-conn" }]);
    const staleWhere = vi.fn().mockReturnValue({ returning: staleReturning });
    db._chains.update.set.mockReturnValue({ where: staleWhere });

    const result = await syncTerraConnections(db, client, "user-abc");

    expect(result.revoked).toBe(1);
    expect(db.update).toHaveBeenCalledWith(terraConnection);
  });

  test("calls onNeedsBackfill for active connections with no data", async () => {
    const db = createMockDb();
    const client = makeMockClient([
      makeTerraUser({ user_id: "tu-1", active: true }),
    ]);

    db._chains.insert.returning.mockResolvedValue([{ lastWebhookAt: null }]);

    const staleWhere = { returning: vi.fn().mockResolvedValue([]) };
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockReturnValue(staleWhere),
    });

    const onNeedsBackfill = vi.fn().mockResolvedValue(undefined);
    await syncTerraConnections(db, client, "user-abc", { onNeedsBackfill });

    expect(onNeedsBackfill).toHaveBeenCalledOnce();
    expect(onNeedsBackfill).toHaveBeenCalledWith("tu-1", "FITBIT");
  });

  test("skips onNeedsBackfill when connection already has data", async () => {
    const db = createMockDb();
    const client = makeMockClient([
      makeTerraUser({ user_id: "tu-1", active: true }),
    ]);

    db._chains.insert.returning.mockResolvedValue([
      { lastWebhookAt: new Date() },
    ]);

    const staleWhere = { returning: vi.fn().mockResolvedValue([]) };
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockReturnValue(staleWhere),
    });

    const onNeedsBackfill = vi.fn().mockResolvedValue(undefined);
    await syncTerraConnections(db, client, "user-abc", { onNeedsBackfill });

    expect(onNeedsBackfill).not.toHaveBeenCalled();
  });

  test("skips onNeedsBackfill for revoked connections", async () => {
    const db = createMockDb();
    const client = makeMockClient([
      makeTerraUser({ user_id: "tu-1", active: false }),
    ]);

    db._chains.insert.returning.mockResolvedValue([{ lastWebhookAt: null }]);

    const onNeedsBackfill = vi.fn().mockResolvedValue(undefined);
    await syncTerraConnections(db, client, "user-abc", { onNeedsBackfill });

    expect(onNeedsBackfill).not.toHaveBeenCalled();
  });
});
