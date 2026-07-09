import { createAnthropic } from "@ai-sdk/anthropic";
import { zValidator } from "@hono/zod-validator";
import { generateObject } from "ai";
import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { chat } from "../../../db/schema";
import type { AuthSession, AuthUser, Env } from "../lib/auth";
import {
  CHAT_TITLE_MODEL,
  CHAT_TITLE_SYSTEM_PROMPT,
  MAX_CHATS_PER_USER,
} from "../lib/config";
import { createDb } from "../lib/db";
import { requireAuth } from "../middleware/auth";

const chatRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
}>()

  // List chats
  .get("/", requireAuth, async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const userId = c.get("user").id;

    const chats = await db
      .select({
        id: chat.id,
        title: chat.title,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(eq(chat.userId, userId))
      .orderBy(desc(chat.lastMessageAt), desc(chat.createdAt))
      .limit(50);

    return c.json({ chats });
  })

  // Get single chat (ownership check)
  .get(
    "/:id",
    requireAuth,
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;
      const { id } = c.req.valid("param");

      const [found] = await db
        .select({ id: chat.id, title: chat.title })
        .from(chat)
        .where(and(eq(chat.id, id), eq(chat.userId, userId)))
        .limit(1);

      if (!found) return c.json({ error: "Chat not found" }, 404);
      return c.json(found);
    },
  )

  // Create chat
  .post("/", requireAuth, async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const userId = c.get("user").id;

    const [{ total }] = await db
      .select({ total: count() })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (total >= MAX_CHATS_PER_USER) {
      return c.json(
        { error: `Chat limit reached (max ${MAX_CHATS_PER_USER})` },
        429,
      );
    }

    const [newChat] = await db
      .insert(chat)
      .values({ userId })
      .returning({ id: chat.id });

    return c.json({ id: newChat.id }, 201);
  })

  // Update chat
  .put(
    "/:id",
    requireAuth,
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator(
      "json",
      z.object({
        title: z.string().max(100).optional(),
        lastMessageAt: z.string().datetime().optional(),
      }),
    ),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");

      const [updated] = await db
        .update(chat)
        .set({
          ...(data.title !== undefined && { title: data.title }),
          ...(data.lastMessageAt !== undefined && {
            lastMessageAt: new Date(data.lastMessageAt),
          }),
        })
        .where(and(eq(chat.id, id), eq(chat.userId, userId)))
        .returning({ id: chat.id });

      if (!updated) return c.json({ error: "Chat not found" }, 404);
      return c.json({ success: true });
    },
  )

  // Generate title
  .post(
    "/:id/generate-title",
    requireAuth,
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", z.object({ message: z.string().min(1).max(2000) })),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;
      const { id } = c.req.valid("param");
      const { message } = c.req.valid("json");

      const [found] = await db
        .select({ id: chat.id })
        .from(chat)
        .where(and(eq(chat.id, id), eq(chat.userId, userId)))
        .limit(1);

      if (!found) return c.json({ error: "Chat not found" }, 404);

      const anthropic = createAnthropic({
        apiKey: c.env.ANTHROPIC_API_KEY,
      });
      const { object } = await generateObject({
        model: anthropic(CHAT_TITLE_MODEL),
        schema: z.object({
          title: z.string().max(50).describe("Short conversation title"),
        }),
        system: CHAT_TITLE_SYSTEM_PROMPT,
        prompt: `User message: ${message}`,
      });

      const trimmedTitle = object.title;
      await db.update(chat).set({ title: trimmedTitle }).where(eq(chat.id, id));

      return c.json({ title: trimmedTitle });
    },
  )

  // Delete chat
  .delete(
    "/:id",
    requireAuth,
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL);
      const userId = c.get("user").id;
      const { id } = c.req.valid("param");

      const [deleted] = await db
        .delete(chat)
        .where(and(eq(chat.id, id), eq(chat.userId, userId)))
        .returning({ id: chat.id });

      if (!deleted) return c.json({ error: "Chat not found" }, 404);

      const doId = c.env.ChatAgent.idFromName(id);
      const stub = c.env.ChatAgent.get(doId);
      await stub.destroyChat();

      return c.json({ success: true });
    },
  );

export default chatRoutes;
