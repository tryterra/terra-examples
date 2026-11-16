/**
 * Users + their clinical records. Records are summarized server side
 * (lib/clinical/fhir.ts) so the browser receives readable fields next to the
 * raw FHIR, and never needs Terra credentials.
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { summarizeRecord } from "../lib/clinical/fhir";
import type { TerraUser } from "../lib/clinical/types";
import { getTerraClient, isDemoMode } from "../lib/env";
import {
  getUser,
  getUserRecords,
  listUsers,
  syncUser,
  upsertUser,
} from "../lib/store";
import { respondTerraError } from "./respond";

const demoBlocked = {
  error: "Demo mode: add Terra credentials in .env to sync live records.",
  category: "demo",
} as const;

export const userRoutes = new Hono()
  .get("/", async (c) => c.json({ users: await listUsers() }))
  .post(
    "/",
    zValidator("json", z.object({ userId: z.string().trim().min(1).max(100) })),
    async (c) => {
      if (isDemoMode()) return c.json(demoBlocked, 409);
      const { userId } = c.req.valid("json");
      const client = getTerraClient();
      try {
        // userInfo gives the reference_id + provider to label the user.
        const info = (await client.get("/userInfo", { user_id: userId })) as {
          user?: TerraUser;
        };
        await upsertUser(info.user ?? { user_id: userId });
        const sync = await syncUser(client, userId);
        return c.json({ userId, sync }, 201);
      } catch (err) {
        return respondTerraError(c, err);
      }
    },
  )
  .get("/:userId", async (c) => {
    const userId = c.req.param("userId");
    const user = await getUser(userId);
    if (!user)
      return c.json({ error: "Unknown user", category: "not_found" }, 404);
    const records = (await getUserRecords(userId)).map((record) => ({
      record,
      summary: summarizeRecord(record),
    }));
    // Newest clinical date first; undated records sink to the bottom.
    records.sort((a, b) =>
      (b.summary.date ?? "").localeCompare(a.summary.date ?? ""),
    );
    return c.json({ user, records });
  })
  .post("/:userId/sync", async (c) => {
    if (isDemoMode()) return c.json(demoBlocked, 409);
    const userId = c.req.param("userId");
    if (!(await getUser(userId)))
      return c.json({ error: "Unknown user", category: "not_found" }, 404);
    try {
      return c.json({ userId, sync: await syncUser(getTerraClient(), userId) });
    } catch (err) {
      return respondTerraError(c, err);
    }
  });
