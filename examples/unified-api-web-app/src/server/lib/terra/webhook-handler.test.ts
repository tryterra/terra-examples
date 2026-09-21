import { describe, test, expect, vi } from "vitest";
import type { Terra } from "terra-api";
import {
  extractUserId,
  markEvent,
  processWebhookEvent,
} from "./webhook-handler";
import { createMockDb } from "../db.test-utils";
import {
  terraActivity,
  terraBody,
  terraConnection,
  terraDaily,
  terraMenstruation,
  terraNutrition,
  terraSleep,
  terraWebhookEvent,
} from "../../../../db/schema";

/* ---------------------------------- Fixtures ---------------------------------- */

const CONN_ID = "conn-abc";
const EVENT_ID = "evt-123";
const TERRA_USER_ID = "tu-999";
const USER_ID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";

function makeDataPayload(
  type: string,
  data: unknown[] = [],
  terraUserId = TERRA_USER_ID,
) {
  return {
    type,
    user: { user_id: terraUserId, provider: "FITBIT" } as Terra.TerraUser,
    data,
  } as Terra.WebhookEventType;
}

function makeActivityItem(summaryId: string) {
  return {
    metadata: {
      summary_id: summaryId,
      start_time: "2025-01-01T00:00:00Z",
      end_time: "2025-01-01T01:00:00Z",
      type: 5,
    },
  } as unknown as Terra.Activity;
}

function makeSleepItem(summaryId?: string) {
  return {
    metadata: {
      summary_id: summaryId,
      start_time: "2025-01-01T22:00:00Z",
      end_time: "2025-01-02T06:00:00Z",
    },
  } as unknown as Terra.Sleep;
}

function makeIntervalItem() {
  return {
    metadata: {
      start_time: "2025-01-01T00:00:00Z",
      end_time: "2025-01-01T23:59:59Z",
    },
  } as unknown as Terra.Body &
    Terra.Daily &
    Terra.Nutrition &
    Terra.Menstruation;
}

function setupDbForDataEvent(
  db: ReturnType<typeof createMockDb>,
  connectionFound = true,
) {
  const selectWhere = {
    limit: vi.fn().mockResolvedValue(connectionFound ? [{ id: CONN_ID }] : []),
  };
  db._chains.select.from.mockReturnValue({
    where: vi.fn().mockReturnValue(selectWhere),
  });
}

/* ---------------------------------- extractUserId ---------------------------------- */

describe("extractUserId", () => {
  test("returns user_id from payload with user field", () => {
    const payload = makeDataPayload("activity", [], "tu-abc");
    expect(extractUserId(payload)).toBe("tu-abc");
  });

  test("returns undefined when payload has no user", () => {
    const payload = {
      type: "healthcheck",
      creation_timestamp: "2025-01-01",
      trend_percentage: 0,
      sent_webhooks_last_hour: 0,
    } as Terra.WebhookEventType;
    expect(extractUserId(payload)).toBeUndefined();
  });
});

/* ---------------------------------- markEvent ---------------------------------- */

describe("markEvent", () => {
  test("updates status and processedAt", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await markEvent(db, EVENT_ID, "processed");

    expect(db.update).toHaveBeenCalledWith(terraWebhookEvent);
    const setCall = db._chains.update.set.mock.calls[0][0];
    expect(setCall.status).toBe("processed");
    expect(setCall.error).toBeNull();
    expect(setCall.processedAt).toBeInstanceOf(Date);
  });

  test("includes error message when provided", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await markEvent(db, EVENT_ID, "failed", "something broke");

    const setCall = db._chains.update.set.mock.calls[0][0];
    expect(setCall.status).toBe("failed");
    expect(setCall.error).toBe("something broke");
  });
});

/* ---------------------------------- processWebhookEvent: data ---------------------------------- */

describe("processWebhookEvent — data events", () => {
  test("activity event upserts records and updates lastWebhookAt", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const payload = makeDataPayload("activity", [makeActivityItem("s1")]);
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(db.insert).toHaveBeenCalledWith(terraActivity);
    expect(db.update).toHaveBeenCalledWith(terraConnection);
  });

  test("sleep event filters items without summary_id", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const payload = makeDataPayload("sleep", [
      makeSleepItem("valid-id"),
      makeSleepItem(undefined),
    ]);
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(db.insert).toHaveBeenCalledWith(terraSleep);
    const valuesCall = db._chains.insert.values.mock.calls[0][0];
    expect(valuesCall).toHaveLength(1);
    expect(valuesCall[0].summaryId).toBe("valid-id");
  });

  test("sleep with all items lacking summary_id skips insert", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const payload = makeDataPayload("sleep", [
      makeSleepItem(undefined),
      makeSleepItem(undefined),
    ]);
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(db.insert).not.toHaveBeenCalledWith(terraSleep);
  });

  test.each([
    ["body", terraBody],
    ["daily", terraDaily],
    ["nutrition", terraNutrition],
    ["menstruation", terraMenstruation],
  ])("%s event upserts to correct table", async (type, table) => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const payload = makeDataPayload(type, [makeIntervalItem()]);
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(db.insert).toHaveBeenCalledWith(table);
  });

  test("empty data array marks processed without DB writes", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const payload = makeDataPayload("activity", []);
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(db.insert).not.toHaveBeenCalled();
    const statusCalls = db._chains.update.set.mock.calls;
    expect(statusCalls.some((c: any) => c[0].status === "processed")).toBe(
      true,
    );
  });

  test("missing user_id marks processed without DB writes", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const payload = {
      type: "activity",
      data: [makeActivityItem("s1")],
    } as unknown as Terra.WebhookEventType;
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(db.select).not.toHaveBeenCalled();
  });

  test("maps activity fields correctly including type=0 edge case", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const item = {
      metadata: {
        summary_id: "sum-1",
        start_time: "2025-06-15T10:00:00Z",
        end_time: "2025-06-15T11:30:00Z",
        type: 0,
      },
    } as unknown as Terra.Activity;

    const payload = makeDataPayload("activity", [item]);
    await processWebhookEvent(db, EVENT_ID, payload);

    const row = db._chains.insert.values.mock.calls[0][0][0];
    expect(row.terraConnectionId).toBe(CONN_ID);
    expect(row.summaryId).toBe("sum-1");
    expect(row.startTime).toEqual(new Date("2025-06-15T10:00:00Z"));
    expect(row.endTime).toEqual(new Date("2025-06-15T11:30:00Z"));
    expect(row.activityType).toBe("0");
  });

  test("maps activityType to null when metadata type is null", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const item = {
      metadata: {
        summary_id: "sum-2",
        start_time: "2025-01-01T00:00:00Z",
        end_time: "2025-01-01T01:00:00Z",
        type: null,
      },
    } as unknown as Terra.Activity;

    const payload = makeDataPayload("activity", [item]);
    await processWebhookEvent(db, EVENT_ID, payload);

    const row = db._chains.insert.values.mock.calls[0][0][0];
    expect(row.activityType).toBeNull();
  });

  test("maps activityType to null when metadata type is undefined", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const item = {
      metadata: {
        summary_id: "sum-3",
        start_time: "2025-01-01T00:00:00Z",
        end_time: "2025-01-01T01:00:00Z",
      },
    } as unknown as Terra.Activity;

    const payload = makeDataPayload("activity", [item]);
    await processWebhookEvent(db, EVENT_ID, payload);

    const row = db._chains.insert.values.mock.calls[0][0][0];
    expect(row.activityType).toBeNull();
  });

  test("upserts all items in multi-item activity batch", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const payload = makeDataPayload("activity", [
      makeActivityItem("s1"),
      makeActivityItem("s2"),
      makeActivityItem("s3"),
    ]);
    await processWebhookEvent(db, EVENT_ID, payload);

    const rows = db._chains.insert.values.mock.calls[0][0];
    expect(rows).toHaveLength(3);
    expect(rows.map((r: any) => r.summaryId)).toEqual(["s1", "s2", "s3"]);
  });

  test("sets lastWebhookAt to a Date on connection update", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db);

    const payload = makeDataPayload("activity", [makeActivityItem("s1")]);
    await processWebhookEvent(db, EVENT_ID, payload);

    const connUpdateIdx = db.update.mock.calls.findIndex(
      (c: any) => c[0] === terraConnection,
    );
    expect(connUpdateIdx).toBeGreaterThanOrEqual(0);
    const setArg = db._chains.update.set.mock.calls[connUpdateIdx][0];
    expect(setArg.lastWebhookAt).toBeInstanceOf(Date);
  });

  test("unknown terraUserId marks event failed", async () => {
    const db = createMockDb();
    setupDbForDataEvent(db, false);
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const payload = makeDataPayload(
      "activity",
      [makeActivityItem("s1")],
      "tu-unknown",
    );
    await processWebhookEvent(db, EVENT_ID, payload);

    const statusCalls = db._chains.update.set.mock.calls;
    expect(statusCalls.some((c: any) => c[0].status === "failed")).toBe(true);
    expect(
      statusCalls.some((c: any) => c[0].error?.includes("tu-unknown")),
    ).toBe(true);
  });
});

/* ---------------------------------- processWebhookEvent: auth ---------------------------------- */

describe("processWebhookEvent — auth events", () => {
  function setupDbForAuth(
    db: ReturnType<typeof createMockDb>,
    userFound = true,
  ) {
    const selectWhere = {
      limit: vi.fn().mockResolvedValue(userFound ? [{ id: USER_ID }] : []),
    };
    db._chains.select.from.mockReturnValue({
      where: vi.fn().mockReturnValue(selectWhere),
    });
  }

  function makeAuthPayload(overrides?: Record<string, unknown>) {
    return {
      type: "auth",
      reference_id: USER_ID,
      user: {
        user_id: TERRA_USER_ID,
        provider: "FITBIT",
        scopes: "activity,sleep",
      },
      ...overrides,
    } as unknown as Terra.WebhookEventType;
  }

  test("auth event with valid reference_id upserts connection", async () => {
    const db = createMockDb();
    setupDbForAuth(db);

    await processWebhookEvent(db, EVENT_ID, makeAuthPayload());

    expect(db.insert).toHaveBeenCalledWith(terraConnection);
  });

  test("auth event with non-UUID reference_id throws", async () => {
    const db = createMockDb();

    await expect(
      processWebhookEvent(
        db,
        EVENT_ID,
        makeAuthPayload({ reference_id: "not-a-uuid" }),
      ),
    ).rejects.toThrow("Invalid or missing reference_id");
  });

  test("auth event with unknown user throws", async () => {
    const db = createMockDb();
    setupDbForAuth(db, false);

    await expect(
      processWebhookEvent(db, EVENT_ID, makeAuthPayload()),
    ).rejects.toThrow("not found");
  });

  test("onAuthSuccess is called with terraUserId and scopes after successful auth", async () => {
    const db = createMockDb();
    setupDbForAuth(db);
    const onAuthSuccess = vi.fn().mockResolvedValue(undefined);

    await processWebhookEvent(db, EVENT_ID, makeAuthPayload(), {
      onAuthSuccess,
    });

    expect(onAuthSuccess).toHaveBeenCalledOnce();
    expect(onAuthSuccess).toHaveBeenCalledWith(TERRA_USER_ID, "FITBIT");
  });

  test("onAuthSuccess is not called when auth event fails", async () => {
    const db = createMockDb();
    setupDbForAuth(db, false);
    const onAuthSuccess = vi.fn().mockResolvedValue(undefined);

    await expect(
      processWebhookEvent(db, EVENT_ID, makeAuthPayload(), { onAuthSuccess }),
    ).rejects.toThrow();

    expect(onAuthSuccess).not.toHaveBeenCalled();
  });

  test("onAuthSuccess is not called for non-auth events", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const onAuthSuccess = vi.fn().mockResolvedValue(undefined);

    const payload = {
      type: "deauth",
      user: { user_id: TERRA_USER_ID },
    } as unknown as Terra.WebhookEventType;

    await processWebhookEvent(db, EVENT_ID, payload, { onAuthSuccess });

    expect(onAuthSuccess).not.toHaveBeenCalled();
  });

  test.each(["deauth", "access_revoked"] as const)(
    "%s event sets connection status to revoked",
    async (type) => {
      const db = createMockDb();
      db._chains.update.set.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const payload = {
        type,
        user: { user_id: TERRA_USER_ID },
      } as unknown as Terra.WebhookEventType;

      await processWebhookEvent(db, EVENT_ID, payload);

      expect(db.update).toHaveBeenCalledWith(terraConnection);
      const setCall = db._chains.update.set.mock.calls[0][0];
      expect(setCall.status).toBe("revoked");
    },
  );

  test("user_reauth swaps terraUserId", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const payload = {
      type: "user_reauth",
      old_user: { user_id: "old-tu" },
      new_user: { user_id: "new-tu" },
    } as unknown as Terra.WebhookEventType;

    await processWebhookEvent(db, EVENT_ID, payload);

    const setCall = db._chains.update.set.mock.calls[0][0];
    expect(setCall.terraUserId).toBe("new-tu");
    expect(setCall.status).toBe("active");
  });

  test("connection_error sets status to error", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const payload = {
      type: "connection_error",
      user: { user_id: TERRA_USER_ID },
    } as unknown as Terra.WebhookEventType;

    await processWebhookEvent(db, EVENT_ID, payload);

    const setCall = db._chains.update.set.mock.calls[0][0];
    expect(setCall.status).toBe("error");
  });

  test("permission_change updates scopes", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const payload = {
      type: "permission_change",
      user: { user_id: TERRA_USER_ID, scopes: "activity,sleep,body" },
    } as unknown as Terra.WebhookEventType;

    await processWebhookEvent(db, EVENT_ID, payload);

    const setCall = db._chains.update.set.mock.calls[0][0];
    expect(setCall.scopes).toEqual(["activity", "sleep", "body"]);
  });
});

/* ---------------------------------- processWebhookEvent: informational ---------------------------------- */

describe("processWebhookEvent — informational events", () => {
  test("healthcheck marks processed with no side effects", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const payload = {
      type: "healthcheck",
      creation_timestamp: "2025-01-01",
      trend_percentage: 0,
      sent_webhooks_last_hour: 0,
    } as Terra.WebhookEventType;

    await processWebhookEvent(db, EVENT_ID, payload);

    expect(db.insert).not.toHaveBeenCalled();
    const statusCalls = db._chains.update.set.mock.calls;
    expect(statusCalls.some((c: any) => c[0].status === "processed")).toBe(
      true,
    );
  });

  test.each([
    "processing",
    "large_request_processing",
    "large_request_sending",
    "rate_limit_hit",
    "google_no_datasource",
  ])("%s event logs and marks processed", async (type) => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const payload = { type } as unknown as Terra.WebhookEventType;
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(type));
  });

  test("unknown event type warns and marks processed", async () => {
    const db = createMockDb();
    db._chains.update.set.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const payload = {
      type: "future_event",
    } as unknown as Terra.WebhookEventType;
    await processWebhookEvent(db, EVENT_ID, payload);

    expect(warnSpy).toHaveBeenCalled();
    const statusCalls = db._chains.update.set.mock.calls;
    expect(statusCalls.some((c: any) => c[0].status === "processed")).toBe(
      true,
    );
  });
});
