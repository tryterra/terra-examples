/**
 * Seed the demo roster. Idempotent: patients are keyed by a stable
 * reference_id, so re-running updates names instead of duplicating rows.
 * Prints each patient's reference_id — that's the string to use when
 * uploading reports or connecting wearables outside the app.
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { createDb, schema } from "../src/server/lib/db";

const PATIENTS = [
  {
    id: "pt_jane_cooper",
    firstName: "Jane",
    lastName: "Cooper",
    dateOfBirth: "1979-03-14",
    sex: "female" as const,
    referenceId: "demo-patient-jane-cooper",
  },
  {
    id: "pt_marcus_reid",
    firstName: "Marcus",
    lastName: "Reid",
    dateOfBirth: "1968-11-02",
    sex: "male" as const,
    referenceId: "demo-patient-marcus-reid",
  },
  {
    id: "pt_elena_vasquez",
    firstName: "Elena",
    lastName: "Vasquez",
    dateOfBirth: "1991-07-22",
    sex: "female" as const,
    referenceId: "demo-patient-elena-vasquez",
  },
  {
    id: "pt_tom_okafor",
    firstName: "Tom",
    lastName: "Okafor",
    dateOfBirth: "1985-01-30",
    sex: "male" as const,
    referenceId: "demo-patient-tom-okafor",
  },
];

mkdirSync("./data", { recursive: true });
const db = createDb();
await migrate(db, { migrationsFolder: "./db/migrations" });

for (const p of PATIENTS) {
  await db
    .insert(schema.patient)
    .values(p)
    .onConflictDoUpdate({
      target: schema.patient.id,
      set: {
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth,
        sex: p.sex,
        referenceId: p.referenceId,
      },
    });
  console.error(`✓ ${p.firstName} ${p.lastName} — reference_id ${p.referenceId}`);
}
console.error(`Seeded ${PATIENTS.length} patients.`);
