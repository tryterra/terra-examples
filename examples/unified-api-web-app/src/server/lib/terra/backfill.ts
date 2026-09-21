import type { TerraClient } from "terra-api";

const BACKFILL_DAYS = 30;

const DATA_RESOURCES = [
  "activity",
  "sleep",
  "body",
  "daily",
  "nutrition",
  "menstruation",
] as const satisfies readonly (keyof TerraClient)[];

type DataResource = (typeof DATA_RESOURCES)[number];

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

/** Requests historical data for a newly connected provider over the last BACKFILL_DAYS. */
export async function requestBackfill(
  client: TerraClient,
  terraUserId: string,
  provider: string,
) {
  const resources = await getSupportedResources(client, provider);
  if (resources.length === 0) {
    console.log(
      `Backfill skipped: no supported resources for provider=${provider}`,
    );
    return;
  }

  console.log(
    `Backfill starting: terraUser=${terraUserId} provider=${provider} resources=[${resources.join(", ")}] days=${BACKFILL_DAYS}`,
  );

  const startDate = Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400;

  const results = await Promise.allSettled(
    resources.map((r) =>
      client[r].fetch({ user_id: terraUserId, start_date: startDate }),
    ),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results
    .map((r, i) => (r.status === "rejected" ? resources[i] : null))
    .filter(Boolean);

  if (failed.length > 0) {
    console.warn(
      `Backfill partial: terraUser=${terraUserId} succeeded=${succeeded} failed=[${failed.join(", ")}]`,
    );
  } else {
    console.log(
      `Backfill completed: terraUser=${terraUserId} resources=${succeeded}`,
    );
  }
}

/** Returns the data types a provider supports, falling back to all resources on error. */
async function getSupportedResources(
  client: TerraClient,
  provider: string,
): Promise<DataResource[]> {
  try {
    const result = await client.integrations.detailedfetch({ sdk: false });
    const integration = result.providers?.find(
      (p) => p.provider?.toUpperCase() === provider.toUpperCase(),
    );
    if (!integration?.types) return [...DATA_RESOURCES];

    return DATA_RESOURCES.filter((r) => integration.types?.[r] === true);
  } catch {
    return [...DATA_RESOURCES];
  }
}
