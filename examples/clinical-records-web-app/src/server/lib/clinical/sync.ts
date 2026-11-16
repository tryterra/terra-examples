/**
 * Pull-API backfill: page GET /v2/clinicalRecord until `has_more` is false.
 * Pure over a minimal `get` client so it can be lifted into any backend.
 *
 * Contract worth knowing:
 * - `next_cursor` is always returned, even on the last page. Keep the last
 *   one: resuming from it later returns only records received since.
 * - Records received in the last 60 seconds are held back so a cursor never
 *   skips a record that was still becoming visible; the next sync gets them.
 * - A cursor is bound to the filters it was issued under. Changing
 *   `clinical_type`/`resource_type` with an old cursor is a 400.
 */
import type { ClinicalRecord, ClinicalRecordPage } from "./types";

export interface ClinicalRecordGetter {
  get(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<unknown>;
}

export const PAGE_LIMIT = 100; // API maximum

export interface BackfillOptions {
  userId: string;
  /** Resume position from a previous sync; omit for a full backfill. */
  cursor?: string | null;
  /** Called once per page, so callers can persist records + cursor as they go. */
  onPage: (records: ClinicalRecord[], nextCursor: string) => Promise<void>;
  /** Safety valve for a single request; the cursor lets the next run continue. */
  maxPages?: number;
}

export interface BackfillResult {
  pages: number;
  records: number;
  cursor: string | null;
  /** True when maxPages stopped the loop before the API ran out of records. */
  truncated: boolean;
}

export async function backfillClinicalRecords(
  client: ClinicalRecordGetter,
  opts: BackfillOptions,
): Promise<BackfillResult> {
  const maxPages = opts.maxPages ?? 50;
  let cursor = opts.cursor ?? null;
  let pages = 0;
  let records = 0;
  for (;;) {
    const page = (await client.get("/clinicalRecord", {
      user_id: opts.userId,
      limit: PAGE_LIMIT,
      cursor: cursor ?? undefined,
    })) as ClinicalRecordPage;
    pages += 1;
    records += page.data.length;
    cursor = page.next_cursor || cursor;
    await opts.onPage(page.data, cursor ?? "");
    if (!page.has_more) return { pages, records, cursor, truncated: false };
    if (pages >= maxPages) return { pages, records, cursor, truncated: true };
  }
}
