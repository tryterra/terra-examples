/** Local SQLite (libsql) via Drizzle. File lives in ./data (gitignored). */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../../db/schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(
  url = process.env.DATABASE_URL ?? "file:./data/app.db",
) {
  return drizzle(createClient({ url }), { schema });
}

export { schema };
