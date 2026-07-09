import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/client/lib/api";

export const profileQueryOpts = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const res = await api.api.users.profile.$get();
    if (!res.ok) throw new Error("Failed to load profile");
    return res.json();
  },
});

export function useProfile() {
  return useQuery(profileQueryOpts);
}
