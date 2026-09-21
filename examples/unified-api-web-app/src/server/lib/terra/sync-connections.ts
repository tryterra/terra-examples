import { eq, sql, and, notInArray } from "drizzle-orm";
import type { Terra, TerraClient } from "terra-api";
import { terraConnection } from "../../../../db/schema";
import type { Database } from "../db";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Parses a comma-separated scopes string into an array, returning null if empty. */
export function parseScopes(scopes?: string): string[] | null {
  if (!scopes) return null;
  const list = scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

/** Syncs local connections with the Terra API — creates new, updates existing, and marks stale as revoked. */
export async function syncTerraConnections(
  db: Database,
  client: TerraClient,
  userId: string,
  options?: {
    onNeedsBackfill?: (terraUserId: string, provider: string) => Promise<void>;
  },
): Promise<{ synced: number; revoked: number }> {
  const result = (await client.user.getinfoforuserid({
    reference_id: userId,
  })) as Terra.UserGetAllUserIDsResponse;

  const terraUsers = ("users" in result ? result.users : []) ?? [];

  let synced = 0;
  let revoked = 0;
  const seenTerraUserIds: string[] = [];

  for (const tu of terraUsers) {
    seenTerraUserIds.push(tu.user_id);
    const status = tu.active === false ? "revoked" : "active";
    const scopes = parseScopes(tu.scopes);

    const [conn] = await db
      .insert(terraConnection)
      .values({
        userId,
        terraUserId: tu.user_id,
        referenceId: userId,
        provider: tu.provider,
        scopes,
        status,
      })
      .onConflictDoUpdate({
        target: terraConnection.terraUserId,
        set: {
          provider: tu.provider,
          scopes,
          status,
          updatedAt: sql`now()`,
        },
      })
      .returning({ lastWebhookAt: terraConnection.lastWebhookAt });

    if (status !== "active") {
      revoked++;
      continue;
    }

    synced++;

    const hasNeverReceivedData = !conn.lastWebhookAt;
    if (hasNeverReceivedData) {
      await options?.onNeedsBackfill?.(tu.user_id, tu.provider);
    }
  }

  if (seenTerraUserIds.length > 0) {
    const staleResult = await db
      .update(terraConnection)
      .set({ status: "revoked", updatedAt: sql`now()` })
      .where(
        and(
          eq(terraConnection.userId, userId),
          eq(terraConnection.status, "active"),
          notInArray(terraConnection.terraUserId, seenTerraUserIds),
        ),
      )
      .returning({ id: terraConnection.id });
    revoked += staleResult.length;
  } else {
    const staleResult = await db
      .update(terraConnection)
      .set({ status: "revoked", updatedAt: sql`now()` })
      .where(
        and(
          eq(terraConnection.userId, userId),
          eq(terraConnection.status, "active"),
        ),
      )
      .returning({ id: terraConnection.id });
    revoked += staleResult.length;
  }

  return { synced, revoked };
}
