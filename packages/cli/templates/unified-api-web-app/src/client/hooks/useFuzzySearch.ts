import { useMemo } from "react";
import Fuse, { type IFuseOptions } from "fuse.js";

export function useFuzzySearch<T>(
  items: T[],
  query: string,
  keys: IFuseOptions<T>["keys"],
  options?: Omit<IFuseOptions<T>, "keys">,
): T[] {
  const fuse = useMemo(
    () => new Fuse(items, { keys, threshold: 0.4, ...options }),
    [items, keys, options],
  );

  return useMemo(() => {
    if (!query.trim()) return items;
    return fuse.search(query).map((r) => r.item);
  }, [fuse, query, items]);
}
