/** Local SQLite (libsql) via Drizzle. File lives in ./data (gitignored). */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../db/schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(
  url = process.env.DATABASE_URL ?? "file:./data/app.db",
) {
  return drizzle(createClient({ url }), { schema });
}

let shared: Db | undefined;

/** One connection per process, opened lazily (tests set DATABASE_URL first). */
export function getDb(): Db {
  shared ??= createDb();
  return shared;
}

export async function migrateDb(db: Db = getDb()) {
  await migrate(db, { migrationsFolder: "./db/migrations" });
}

export { schema };
