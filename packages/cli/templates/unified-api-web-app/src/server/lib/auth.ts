import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import * as schema from "../../../db/schema";
import type { ChatAgent } from "../agents/chat-agent";
import { authOptions } from "./auth-options";
import { createDb } from "./db";

export type Env = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  TERRA_DEV_ID?: string;
  TERRA_API_KEY?: string;
  TERRA_WEBHOOK_SECRET?: string;
  TERRA_WEBHOOKS_BUCKET?: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  ChatAgent: DurableObjectNamespace<ChatAgent>;
  LOADER?: WorkerLoader;
};

type Auth = ReturnType<typeof getAuth>;
type SessionData = Auth["$Infer"]["Session"];
export type AuthUser = SessionData["user"];
export type AuthSession = SessionData["session"];

async function sendEmail(env: Env, to: string, subject: string, html: string) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.SENDGRID_FROM_EMAIL },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!res.ok) {
    console.error("SendGrid error:", res.status, await res.text());
  }
}

export function getAuth(env: Env, baseURL: string) {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    ...authOptions,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (!env.SENDGRID_API_KEY) {
            console.log(`[OTP] ${email} → ${otp} (${type})`);
            return;
          }

          const subject =
            type === "sign-in"
              ? "Your sign-in code"
              : type === "email-verification"
                ? "Verify your email"
                : "Reset your password";

          await sendEmail(
            env,
            email,
            subject,
            `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 5 minutes.</p>`,
          );
        },
      }),
    ],
  });
}
