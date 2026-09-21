import { isCancel, select } from "@clack/prompts";
import { bail, runCapture, runJson, updateEnvValue, type Env } from "./helpers";
import { getReporter, isInteractive } from "./output";
import { getWorkerName } from "./wrangler";

const NEON = "neonctl";
const REGION = process.env.NEON_REGION || "aws-us-east-1";

export interface NeonResult {
  devDatabaseUrl: string;
  prodDatabaseUrl: string;
}

interface Named {
  id: string;
  name: string;
}

/** neonctl `list` commands emit either a bare array or `{ <key>: [...] }`. */
function toArray<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  const nested = (data as Record<string, unknown>)?.[key];
  return Array.isArray(nested) ? (nested as T[]) : [];
}

/** Appends `?sslmode=require` unless the URI already sets sslmode. */
function withSsl(uri: string): string {
  return uri.includes("sslmode=") ? uri : `${uri}?sslmode=require`;
}

/** Connection string for a branch (default/prod branch when omitted). */
export function connectionString(projectId: string, branch?: string): string {
  const target = branch ? ` ${branch}` : "";
  return withSsl(
    runCapture(`${NEON} connection-string${target} --project-id ${projectId}`),
  );
}

/** Resolves the org id: NEON_ORG_ID, the only org, or an interactive pick. */
async function resolveOrg(env: Env): Promise<string> {
  if (env.NEON_ORG_ID) return env.NEON_ORG_ID;
  const orgs = toArray<Named>(
    runJson(`${NEON} orgs list -o json`),
    "organizations",
  );
  if (orgs.length === 0) bail("No Neon organizations found for this account.");
  if (orgs.length === 1) return orgs[0].id;
  if (!isInteractive())
    bail(
      `Multiple Neon orgs found — set NEON_ORG_ID to one of: ${orgs.map((o) => o.id).join(", ")}`,
    );
  const picked = await select({
    message: "Which Neon organization?",
    options: orgs.map((o) => ({ value: o.id, label: `${o.name} (${o.id})` })),
  });
  if (isCancel(picked)) bail("Setup cancelled.");
  return picked;
}

/** Returns the existing project id for `name`, creating it if absent. */
function findOrCreateProject(orgId: string, name: string): string {
  const existing = toArray<Named>(
    runJson(`${NEON} projects list --org-id ${orgId} -o json`),
    "projects",
  ).find((p) => p.name === name);
  if (existing) {
    getReporter().success(`Using existing Neon project "${name}"`);
    return existing.id;
  }

  const s = getReporter().task();
  s.start(`Creating Neon project "${name}"`);
  const created = runJson<{ project?: Named; id?: string }>(
    `${NEON} projects create --name ${name} --org-id ${orgId} --region-id ${REGION} --cu 0.25-1 -o json`,
  );
  const id = created.project?.id ?? created.id;
  if (!id) bail("Could not read the new Neon project id.");
  s.stop(`Created Neon project "${name}"`);
  return id;
}

/** Creates the "dev" branch if the project doesn't already have one. */
function ensureDevBranch(projectId: string): void {
  const exists = toArray<Named>(
    runJson(`${NEON} branches list --project-id ${projectId} -o json`),
    "branches",
  ).some((b) => b.name === "dev");
  if (exists) {
    getReporter().success('Using existing "dev" branch');
    return;
  }
  runCapture(
    `${NEON} branches create --project-id ${projectId} --name dev -o json`,
  );
  getReporter().success('Created "dev" branch');
}

/** Finds or creates the Neon project + dev branch, returns both branch URLs. */
export async function provisionNeon(env: Env): Promise<NeonResult> {
  const orgId = await resolveOrg(env);
  const projectId = findOrCreateProject(orgId, env.APP_NAME || getWorkerName());
  ensureDevBranch(projectId);

  updateEnvValue(".env", "NEON_ORG_ID", orgId);
  updateEnvValue(".env", "NEON_PROJECT_ID", projectId);

  return {
    prodDatabaseUrl: connectionString(projectId),
    devDatabaseUrl: connectionString(projectId, "dev"),
  };
}

/** Deletes the whole Neon project (used by reset). */
export function deleteProject(projectId: string): void {
  runCapture(`${NEON} projects delete ${projectId} -o json`);
  getReporter().success(`Deleted Neon project ${projectId}`);
}
