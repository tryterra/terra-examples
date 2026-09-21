import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/client/lib/api";

export const appConfigQueryOpts = queryOptions({
  queryKey: ["app-config"],
  queryFn: async () => {
    const res = await api.api.config.$get();
    if (!res.ok) throw new Error("Failed to load app config");
    return res.json();
  },
});

export function useAppConfig() {
  return useQuery(appConfigQueryOpts);
}
