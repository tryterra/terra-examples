/**
 * Zero-credential demo bootstrap. MUST be imported before ./index: route
 * modules open the SQLite file at import time, which creates an empty
 * ./data/app.db — this has to copy the bundled sample snapshot first.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { isDemoMode } from "./lib/env";

mkdirSync("./data", { recursive: true });
if (
  isDemoMode() &&
  !process.env.DATABASE_URL &&
  !existsSync("./data/app.db") &&
  existsSync("./db/demo.db")
) {
  copyFileSync("./db/demo.db", "./data/app.db");
  console.error("demo mode: seeded ./data/app.db from db/demo.db");
}
