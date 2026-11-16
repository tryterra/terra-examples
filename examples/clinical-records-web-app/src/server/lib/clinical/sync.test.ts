import { describe, expect, it, vi } from "vitest";
import { backfillClinicalRecords } from "./sync";
import type { ClinicalRecord } from "./types";

const r = (id: string) => ({ record_id: id }) as ClinicalRecord;

describe("backfillClinicalRecords", () => {
  it("pages until has_more is false, passing the cursor forward", async () => {
    const pages = [
      { data: [r("a"), r("b")], next_cursor: "c1", has_more: true },
      { data: [r("c")], next_cursor: "c2", has_more: false },
    ];
    const get = vi.fn(async () => pages.shift());
    const seen: string[] = [];
    const result = await backfillClinicalRecords(
      { get },
      {
        userId: "u1",
        onPage: async (recs, cursor) => {
          seen.push(`${recs.length}@${cursor}`);
        },
      },
    );
    expect(result).toEqual({
      pages: 2,
      records: 3,
      cursor: "c2",
      truncated: false,
    });
    expect(seen).toEqual(["2@c1", "1@c2"]);
    expect(get).toHaveBeenNthCalledWith(1, "/clinicalRecord", {
      user_id: "u1",
      limit: 100,
      cursor: undefined,
    });
    expect(get).toHaveBeenNthCalledWith(2, "/clinicalRecord", {
      user_id: "u1",
      limit: 100,
      cursor: "c1",
    });
  });

  it("resumes from a stored cursor and stops at maxPages", async () => {
    const get = vi.fn(async () => ({
      data: [r("x")],
      next_cursor: "next",
      has_more: true,
    }));
    const result = await backfillClinicalRecords(
      { get },
      { userId: "u1", cursor: "saved", maxPages: 1, onPage: async () => {} },
    );
    expect(get).toHaveBeenCalledWith("/clinicalRecord", {
      user_id: "u1",
      limit: 100,
      cursor: "saved",
    });
    expect(result).toMatchObject({ pages: 1, truncated: true, cursor: "next" });
  });
});
