import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { user, userInfo } from "../../../db/schema";
import type { AuthSession, AuthUser, Env } from "../lib/auth";
import { createDb } from "../lib/db";
import { requireAuth } from "../middleware/auth";

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  age: z.number().int().min(1).max(150),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  heightCm: z.number().int().min(1).max(300),
  weightKg: z.number().int().min(1).max(500),
  lifestyleGoals: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/*                                    Route                                   */
/* -------------------------------------------------------------------------- */

const onboarding = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>()
  .use("*", requireAuth)
  .get("/status", async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;

      const [row] = await db
        .select({ onboardingStep: user.onboardingStep })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const step = row?.onboardingStep ?? "profile";

      return c.json({
        completed: step === "completed",
        step: step === "completed" ? null : step,
      });
    } catch (error) {
      console.error("Onboarding status error:", error);
      return c.json({ error: "Failed to load onboarding status" }, 500);
    }
  })
  .post("/profile", zValidator("json", profileSchema), async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;
      const data = c.req.valid("json");

      const profileData = {
        age: data.age,
        gender: data.gender,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        lifestyleGoals: data.lifestyleGoals,
      };

      await db
        .insert(userInfo)
        .values({ userId, ...profileData })
        .onConflictDoUpdate({
          target: userInfo.userId,
          set: profileData,
        });

      await db
        .update(user)
        .set({ onboardingStep: "connect" })
        .where(eq(user.id, userId));

      return c.json({ success: true });
    } catch (error) {
      console.error("Onboarding profile error:", error);
      return c.json({ error: "Failed to save profile" }, 500);
    }
  })
  .post("/complete", async (c) => {
    try {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;

      const [existing] = await db
        .select({ userId: userInfo.userId })
        .from(userInfo)
        .where(eq(userInfo.userId, userId))
        .limit(1);

      if (!existing) {
        return c.json({ error: "Profile not completed" }, 400);
      }

      await db
        .update(user)
        .set({ onboardingStep: "completed" })
        .where(eq(user.id, userId));

      return c.json({ success: true });
    } catch (error) {
      console.error("Onboarding complete error:", error);
      return c.json({ error: "Failed to complete onboarding" }, 500);
    }
  });

export default onboarding;
