import { vi } from "vitest";
import type { Database } from "@/server/lib/db";

type ChainResult = Record<string, ReturnType<typeof vi.fn>>;

function chain(terminal: unknown = undefined): ChainResult {
  const obj: ChainResult = {};
  const self = () => obj;

  obj.from = vi.fn(self);
  obj.where = vi.fn(() => Promise.resolve(terminal));
  obj.limit = vi.fn(() => Promise.resolve(terminal));
  obj.values = vi.fn(self);
  obj.set = vi.fn(self);
  obj.onConflictDoUpdate = vi.fn(self);
  obj.onConflictDoNothing = vi.fn(self);
  obj.returning = vi.fn(() => Promise.resolve(terminal));
  obj.orderBy = vi.fn(self);

  obj.where.mockImplementation(() => {
    const whereResult: ChainResult = {
      limit: vi.fn(() => Promise.resolve(terminal)),
      returning: vi.fn(() => Promise.resolve(terminal)),
    };
    return whereResult;
  });

  return obj;
}

export function createMockDb() {
  const selectChain = chain([]);
  const insertChain = chain([]);
  const updateChain = chain([]);
  const deleteChain = chain();
  const selectDistinctChain = chain([]);

  const db = {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
    selectDistinct: vi.fn(() => selectDistinctChain),

    _chains: {
      select: selectChain,
      insert: insertChain,
      update: updateChain,
      delete: deleteChain,
      selectDistinct: selectDistinctChain,
    },
  } as unknown as Database & {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    selectDistinct: ReturnType<typeof vi.fn>;
    _chains: {
      select: ChainResult;
      insert: ChainResult;
      update: ChainResult;
      delete: ChainResult;
      selectDistinct: ChainResult;
    };
  };

  return db;
}
