/** Health agent chat endpoint. */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { aiEnabled, chat } from "../lib/chat";

const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(30),
  patientId: z.string().nullable().optional(),
});

export const chatRoutes = new Hono().post(
  "/chat",
  zValidator("json", chatInput),
  async (c) => {
    if (!aiEnabled()) return c.json({ enabled: false as const });
    const { messages, patientId } = c.req.valid("json");
    try {
      const reply = await chat(messages, patientId ?? null);
      return c.json({ enabled: true as const, reply });
    } catch (err) {
      console.error("chat_error", err);
      return c.json(
        {
          error:
            err instanceof Error ? err.message : "The health agent failed.",
        },
        502,
      );
    }
  },
);
