import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type DashboardConfig, user, userInfo } from "../../../db/schema";
import type { AuthSession, AuthUser, Env } from "../lib/auth";
import { createDb } from "../lib/db";
import { requireAuth } from "../middleware/auth";

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

const users = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>()
  .get(
    "/exists",
    zValidator("query", z.object({ email: z.string().email() })),
    async (c) => {
      try {
        const { email } = c.req.valid("query");
        const db = createDb(c.env.DATABASE_URL);
        const found = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, email))
          .limit(1);

        return c.json({ exists: found.length > 0 });
      } catch (error) {
        console.error("User exists check error:", error);
        return c.json({ error: "Failed to check user" }, 500);
      }
    },
  )
  .get("/profile", requireAuth, async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;

      const [userData, info] = await Promise.all([
        db
          .select({ name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1)
          .then(([row]) => row),
        db
          .select({
            age: userInfo.age,
            gender: userInfo.gender,
            heightCm: userInfo.heightCm,
            weightKg: userInfo.weightKg,
            lifestyleGoals: userInfo.lifestyleGoals,
          })
          .from(userInfo)
          .where(eq(userInfo.userId, userId))
          .limit(1)
          .then(([row]) => row),
      ]);

      return c.json({
        name: userData?.name ?? null,
        email: userData?.email ?? null,
        age: info?.age ?? null,
        gender: info?.gender ?? null,
        heightCm: info?.heightCm ?? null,
        weightKg: info?.weightKg ?? null,
        lifestyleGoals: info?.lifestyleGoals ?? null,
      });
    } catch (error) {
      console.error("User profile fetch error:", error);
      return c.json({ error: "Failed to load profile" }, 500);
    }
  })
  .put(
    "/account",
    requireAuth,
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
      }),
    ),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const data = c.req.valid("json");

        await db
          .update(user)
          .set({ name: data.name })
          .where(eq(user.id, userId));

        return c.json({ success: true });
      } catch (error) {
        console.error("User account update error:", error);
        return c.json({ error: "Failed to update account" }, 500);
      }
    },
  )
  .put(
    "/profile",
    requireAuth,
    zValidator(
      "json",
      z.object({
        age: z.number().int().min(1).max(150).nullable(),
        gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).nullable(),
        heightCm: z.number().int().min(1).max(300).nullable(),
        weightKg: z.number().int().min(1).max(500).nullable(),
        lifestyleGoals: z.string().nullable(),
      }),
    ),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const data = c.req.valid("json");

        const infoData = {
          age: data.age,
          gender: data.gender,
          heightCm: data.heightCm,
          weightKg: data.weightKg,
          lifestyleGoals: data.lifestyleGoals,
        };

        await db
          .insert(userInfo)
          .values({ userId, ...infoData })
          .onConflictDoUpdate({
            target: userInfo.userId,
            set: infoData,
          });

        return c.json({ success: true });
      } catch (error) {
        console.error("User profile update error:", error);
        return c.json({ error: "Failed to update profile" }, 500);
      }
    },
  )
  .get("/dashboard-config", requireAuth, async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;

      const row = await db
        .select({ dashboardConfig: userInfo.dashboardConfig })
        .from(userInfo)
        .where(eq(userInfo.userId, userId))
        .limit(1)
        .then(([r]) => r);

      return c.json({
        dashboardConfig: (row?.dashboardConfig as DashboardConfig) ?? null,
      });
    } catch (error) {
      console.error("Dashboard config fetch error:", error);
      return c.json({ error: "Failed to load dashboard config" }, 500);
    }
  })
  .put(
    "/dashboard-config",
    requireAuth,
    zValidator(
      "json",
      z.object({
        biomarkers: z.array(z.string()),
        scores: z.array(z.string()),
      }),
    ),
    async (c) => {
      try {
        const db = createDb(c.env.DATABASE_URL);
        const userId = c.get("user").id;
        const data = c.req.valid("json");

        await db
          .insert(userInfo)
          .values({ userId, dashboardConfig: data })
          .onConflictDoUpdate({
            target: userInfo.userId,
            set: { dashboardConfig: data },
          });

        return c.json({ success: true });
      } catch (error) {
        console.error("Dashboard config update error:", error);
        return c.json({ error: "Failed to update dashboard config" }, 500);
      }
    },
  )
  .delete("/account", requireAuth, async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;

      await db.delete(user).where(eq(user.id, userId));

      return c.json({ success: true });
    } catch (error) {
      console.error("User account delete error:", error);
      return c.json({ error: "Failed to delete account" }, 500);
    }
  });

export default users;
