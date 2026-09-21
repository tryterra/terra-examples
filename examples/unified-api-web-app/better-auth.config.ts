import { config } from "dotenv";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./db/schema";
import { authOptions } from "./src/server/lib/auth-options";

config({ path: ".env" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export const auth = betterAuth({
  ...authOptions,
  baseURL: "http://localhost",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  plugins: [emailOTP({ async sendVerificationOTP() {} })],
});
